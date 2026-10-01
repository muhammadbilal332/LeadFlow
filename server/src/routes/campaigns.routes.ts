import { Router } from 'express';
import { listCampaigns, getCampaign } from '../controllers/campaignController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', listCampaigns);
router.get('/:id', getCampaign);

export default router;
