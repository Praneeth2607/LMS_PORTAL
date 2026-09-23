import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
