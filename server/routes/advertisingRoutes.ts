import { Request, Response, Router } from 'express';
import { advertisingService } from '../services/advertisingService';
import { HouseAdAudience } from '../../src/types';

export const advertisingRouter = Router();

// GET /api/advertising/config
// Public ad configuration (rotation interval, placements, provider type, etc.)
advertisingRouter.get('/config', (req: Request, res: Response) => {
  try {
    const config = advertisingService.getConfig();
    const providerStatus = advertisingService.getProviderStatus();
    res.json({
      ...config,
      providerStatus
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/advertising/creatives
// Active creatives eligible for rotation for the requesting audience (FREE / PRO / ALL)
advertisingRouter.get('/creatives', (req: Request, res: Response) => {
  try {
    const tier = (req.query.tier as HouseAdAudience) || 'FREE';
    const exchange = req.query.exchange as string | undefined;
    const creatives = advertisingService.getActiveCreatives(tier, exchange);
    res.json({
      success: true,
      count: creatives.length,
      creatives
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/advertising/events/impression
// Records a non-blocking creative impression
advertisingRouter.post('/events/impression', (req: Request, res: Response) => {
  try {
    const { creativeId, placement, userTier, provider } = req.body;
    if (!creativeId) {
      return res.status(400).json({ error: 'creativeId is required' });
    }

    advertisingService.recordImpression({
      creativeId,
      placement: placement || 'DESKTOP_FOOTER',
      userTier: userTier || 'FREE',
      provider: provider || 'HOUSE'
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/advertising/events/click
// Records a user click on a creative
advertisingRouter.post('/events/click', (req: Request, res: Response) => {
  try {
    const { creativeId, placement, userTier, targetUrl, provider } = req.body;
    if (!creativeId) {
      return res.status(400).json({ error: 'creativeId is required' });
    }

    advertisingService.recordClick({
      creativeId,
      placement: placement || 'DESKTOP_FOOTER',
      userTier: userTier || 'FREE',
      targetUrl,
      provider: provider || 'HOUSE'
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
