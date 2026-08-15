import axios from 'axios';
import { EventEmitter } from 'events';
import type { Logger } from 'homebridge';
import type { WeatherConfig } from '../platformUtils.js';

export class WeatherService extends EventEmitter {
  private _humidity: number | undefined;
  private _temperature: number | undefined;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly log: Logger,
    private readonly config: WeatherConfig,
  ) {
    super();
    if (this.config.enabled && this.config.apiKey) {
      this.start();
    }
  }

  public get humidity(): number | undefined {
    return this._humidity;
  }

  public get temperature(): number | undefined {
    return this._temperature;
  }

  private async start() {
    this.log.info('Weather Service starting...');
    await this.updateWeather();
    // Default interval in config is in minutes, convert to ms
    const intervalMs = Math.max(this.config.interval, 5) * 60 * 1000;
    this.timer = setInterval(() => this.updateWeather(), intervalMs);
  }

  private async updateWeather() {
    try {
      let lat: number, lon: number;

      if (this.config.location && this.config.location.includes(',')) {
        const parts = this.config.location.split(',');
        lat = parseFloat(parts[0]);
        lon = parseFloat(parts[1]);
        this.log.debug(`Using manual location: ${lat}, ${lon}`);
      } else if (this.config.location && this.config.location.length > 2) {
        // Try geocoding
        this.log.debug(`Attempting geocoding for location: ${this.config.location}`);
        const geoResponse = await axios.get(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(this.config.location)}&limit=1&appid=${this.config.apiKey}`,
        );
        if (geoResponse.data && geoResponse.data.length > 0) {
          lat = geoResponse.data[0].lat;
          lon = geoResponse.data[0].lon;
          this.log.info(`Geocoded "${this.config.location}" to ${lat}, ${lon} (${geoResponse.data[0].name}, ${geoResponse.data[0].country})`);
        } else {
          throw new Error(`Failed to geocode location: ${this.config.location}`);
        }
      } else {
        // Get location by IP
        this.log.debug('Attempting to determine location by IP...');
        const geoResponse = await axios.get('http://ip-api.com/json/');
        if (geoResponse.data && geoResponse.data.status === 'success') {
          lat = geoResponse.data.lat;
          lon = geoResponse.data.lon;
          this.log.info(`Determined location by IP: ${lat}, ${lon} (${geoResponse.data.city}, ${geoResponse.data.country})`);
        } else {
          throw new Error(`Failed to determine location by IP: ${geoResponse.data?.message || 'Unknown error'}. Please provide a manual location.`);
        }
      }

      this.log.debug(`Fetching weather for ${lat}, ${lon}...`);
      const weatherResponse = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.config.apiKey}&units=metric`);

      if (weatherResponse.data && weatherResponse.data.main) {
        this._humidity = weatherResponse.data.main.humidity;
        this._temperature = weatherResponse.data.main.temp;
        if (this._humidity === 0) {
          this.log.warn(
            `[WeatherService] Received 0% humidity from OpenWeatherMap for location ${lat}, ${lon}. This might be a temporary error or specific local condition.`,
          );
        }
        this.log.info(
          `Weather updated: Humidity ${this._humidity}%, Temperature ${this._temperature}°C (Location: ${weatherResponse.data.name || lat + ',' + lon})`,
        );
        this.emit('update', { humidity: this._humidity, temperature: this._temperature });
      } else {
        throw new Error('Invalid response from OpenWeatherMap API.');
      }
    } catch (error) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message || error.message : error instanceof Error ? error.message : String(error);
      this.log.error(`[WeatherService] Failed to update weather: ${msg}`);
      if (msg.includes('Invalid API key')) {
        this.log.error('[WeatherService] Your OpenWeatherMap API key seems to be invalid or not yet active (it can take up to 2 hours after creation).');
      }
    }
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
