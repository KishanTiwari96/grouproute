import { Router } from 'express';
import tripController, { createTripSchema, syncLocationsSchema } from '../controllers/tripController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/active', tripController.getUserActiveTrips);
router.get('/recommended', tripController.getRecommendedTrips);
router.get('/history', tripController.getTripHistory);
router.get('/stats', tripController.getTripStats);
router.post('/', validate(createTripSchema), tripController.createTrip);
router.get('/:tripId', tripController.getTripDetails);
router.post('/:tripId/start', tripController.startTrip);
router.post('/:tripId/end', tripController.endTrip);
router.put('/:tripId/members/:userId/route', tripController.updateMemberRoute);
router.get('/:tripId/timeline', tripController.getTripTimeline);
router.get('/:tripId/stops', tripController.getTripStops);
router.get('/:tripId/pois', tripController.getTripPOIs);
router.get('/:tripId/locations', tripController.getTripLocations);
router.get('/:tripId/location-history', tripController.getTripLocationHistory);
router.post('/:tripId/locations/sync', validate(syncLocationsSchema), tripController.syncLocations);

export default router;
