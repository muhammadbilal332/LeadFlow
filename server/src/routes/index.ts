import { Router } from 'express';
import authRoutes from './auth.routes';
import leadsRoutes from './leads.routes';
import followUpsRoutes from './followups.routes';
import pipelineRoutes from './pipeline.routes';
import dashboardRoutes from './dashboard.routes';
import reportsRoutes from './reports.routes';
import usersRoutes from './users.routes';
import businessRoutes from './business.routes';
import formsRoutes from './forms.routes';
import publicRoutes from './public.routes';
import notificationsRoutes from './notifications.routes';
import routingRoutes from './routing.routes';
import automationsRoutes from './automations.routes';
import apiKeysRoutes from './apiKeys.routes';
import integrationsRoutes from './integrations.routes';
import webhooksRoutes from './webhooks.routes';
import outreachRoutes from './outreach.routes';
import developerRoutes from './developer.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
router.use('/leads', leadsRoutes);
router.use('/follow-ups', followUpsRoutes);
router.use('/pipeline', pipelineRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/users', usersRoutes);
router.use('/business', businessRoutes);
router.use('/forms', formsRoutes);
router.use('/public', publicRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/routing', routingRoutes);
router.use('/automations', automationsRoutes);
router.use('/api-keys', apiKeysRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/outreach', outreachRoutes);
router.use('/developer', developerRoutes);

export default router;
