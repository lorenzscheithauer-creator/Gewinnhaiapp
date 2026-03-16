import axios from 'axios';

import { ENV } from '../config/env';

export const apiClient = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: ENV.apiTimeoutMs
});
