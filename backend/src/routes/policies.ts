import { Router } from 'express';
import { PolicyModel, PolicyEventModel } from '../db/models.js';

const router = Router();

// GET /api/policies — list with filters
router.get('/', async (req, res, next) => {
  try {
    const { status, type, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status.toUpperCase();
    if (type)   filter.type   = type.toUpperCase();
    if (search) {
      filter.$or = [
        { policyNumber: { $regex: search, $options: 'i' } },
        { holderName:   { $regex: search, $options: 'i' } },
        { holderEmail:  { $regex: search, $options: 'i' } },
      ];
    }

    const [policies, total] = await Promise.all([
      PolicyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      PolicyModel.countDocuments(filter),
    ]);

    res.json({ data: policies, total, page: parseInt(page), ts: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/policies/:policyNumber
router.get('/:policyNumber', async (req, res, next) => {
  try {
    const policy = await PolicyModel
      .findOne({ policyNumber: req.params.policyNumber.toUpperCase() })
      .lean();

    if (!policy) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: `Policy "${req.params.policyNumber}" not found` },
        ts: new Date().toISOString(),
      });
      return;
    }

    const eventCount = await PolicyEventModel.countDocuments({ policyId: policy._id });
    res.json({ data: { ...policy, eventCount }, ts: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// GET /api/policies/:policyNumber/events
router.get('/:policyNumber/events', async (req, res, next) => {
  try {
    const events = await PolicyEventModel
      .find({ policyNumber: req.params.policyNumber.toUpperCase() })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ data: events, total: events.length, ts: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;
