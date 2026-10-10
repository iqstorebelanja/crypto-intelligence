import React, { useState } from 'react';
import { CheckCircle2, MessageSquare, Star, X } from 'lucide-react';
import { FeedbackCategory } from '../types';
import { submitUserFeedback } from '../utils/analytics';

interface UserFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserFeedbackModal: React.FC<UserFeedbackModalProps> = ({ isOpen, onClose }) => {
  const [category, setCategory] = useState<FeedbackCategory>('signal_accuracy');
  const [rating, setRating] = useState<number>(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please provide a brief feedback note.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const ok = await submitUserFeedback({
        category,
        rating,
        message: message.trim()
      });

      if (ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setMessage('');
          onClose();
        }, 1800);
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#0b101c] border border-[#1b273d] rounded-2xl shadow-2xl p-5 space-y-4 font-mono relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-600/40 text-cyan-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">USER FEEDBACK & ACCURACY RATING</h3>
            <p className="text-[11px] text-slate-400">Help optimize our quantitative intelligence engine</p>
          </div>
        </div>

        {submitted ? (
          <div className="p-6 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-emerald-300">Thank You For Your Feedback!</div>
            <p className="text-xs text-slate-400">Your feedback has been recorded into product telemetry.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {error && (
              <div className="p-2.5 bg-rose-950/50 border border-rose-500/50 rounded-lg text-rose-300 text-[11px]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1">Feedback Category:</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as FeedbackCategory)}
                className="w-full px-3 py-2 bg-[#090f1b] border border-[#182338] rounded-xl text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="signal_accuracy">Signal Accuracy & Quantitative Alignment</option>
                <option value="feature_request">Feature Request / Enhancement</option>
                <option value="bug_report">Bug Report / Anomaly</option>
                <option value="ux_usability">UX & Interface Usability</option>
                <option value="general">General Product Feedback</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Rating (1 to 5 Stars):</label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 text-slate-500 hover:text-amber-400 focus:outline-none transition-colors"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-amber-400 font-bold ml-2">{rating} / 5</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Your Observations / Feedback:</label>
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Share your thoughts on signal accuracy, UX clarity, or feature expectations..."
                className="w-full px-3 py-2 bg-[#090f1b] border border-[#182338] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="text-[10px] text-slate-500 leading-tight">
              <strong>Privacy Assurance:</strong> Zero personal passwords, private keys, session tokens, or payment credentials are collected.
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-[#121926] hover:bg-[#182236] text-slate-400 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-cyan-600/30"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
