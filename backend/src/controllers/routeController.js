import mapService from '../services/mapService.js';

export const routeController = {
  async calculate(req, res) {
    try {
      const { origin, destination } = req.body;
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origin and destination are required.' });
      }

      const routeData = await mapService.calculateRoute(origin, destination);
      return res.json(routeData);
    } catch (err) {
      console.error('[Route] Calculate error:', err);
      return res.status(500).json({ error: 'Failed to calculate route.' });
    }
  }
};

export default routeController;
