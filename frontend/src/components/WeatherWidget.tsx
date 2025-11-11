import React, { useState, useEffect } from 'react';
import { Thermometer, Cloud } from 'lucide-react';
import type { WeatherWidgetSettings } from '../lib/api';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  icon?: string;
}

interface WeatherWidgetProps {
  settings: WeatherWidgetSettings;
  compact?: boolean; // For widget card display
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ settings, compact = false }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weatherKey, setWeatherKey] = useState(0); // Key for fade animation

  // Fetch weather data by coordinates
  const fetchWeatherByCoords = async (latitude: number, longitude: number) => {
    try {
      setLoading(true);
      setWeatherError(null);

      const apiKey = import.meta.env.VITE_WEATHER_API_KEY || '';
      
      if (!apiKey) {
        // Fallback: Use a free weather API that doesn't require key
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
        );
        
        if (!response.ok) throw new Error('Weather API failed');
        
        const data = await response.json();
        
        // Get location name (reverse geocoding)
        const locationResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const locationData = await locationResponse.json();
        
        const temp = settings.temperatureUnit === 'F' 
          ? Math.round(data.current_weather.temperature * 9/5 + 32)
          : Math.round(data.current_weather.temperature);
        
        setWeather({
          location: locationData.address?.city || locationData.address?.town || locationData.address?.village || 'Unknown',
          temperature: temp,
          condition: getWeatherCondition(data.current_weather.weathercode),
          icon: '🌤️',
        });
        setWeatherKey(prev => prev + 1);
      } else {
        // Use OpenWeatherMap if API key is provided
        const units = settings.temperatureUnit === 'F' ? 'imperial' : 'metric';
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=${units}`
        );
        
        if (!response.ok) throw new Error('Weather API failed');
        
        const data = await response.json();
        
        setWeather({
          location: data.name,
          temperature: Math.round(data.main.temp),
          condition: data.weather[0].main,
          icon: getWeatherIcon(data.weather[0].icon),
        });
        setWeatherKey(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      setWeatherError('Unable to fetch weather data');
      setWeather({
        location: 'Unknown Location',
        temperature: 0,
        condition: 'Unknown',
        icon: '❓',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch weather data by location name
  const fetchWeatherByLocation = async (location: string) => {
    try {
      setLoading(true);
      setWeatherError(null);

      // First, get coordinates from location name (geocoding)
      const geocodeResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`
      );
      
      if (!geocodeResponse.ok) throw new Error('Geocoding failed');
      
      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData || geocodeData.length === 0) {
        throw new Error('Location not found');
      }

      const { lat, lon } = geocodeData[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);

      // Now fetch weather using coordinates
      await fetchWeatherByCoords(latitude, longitude);
      
      // Update location name from geocoding result
      const locationName = geocodeData[0].display_name.split(',')[0];
      setWeather(prev => prev ? { ...prev, location: locationName } : null);
      setWeatherKey(prev => prev + 1);
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      setWeatherError(error.message || 'Unable to fetch weather data');
      setWeather({
        location: settings.manualLocation || 'Unknown Location',
        temperature: 0,
        condition: 'Unknown',
        icon: '❓',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      if (settings.locationMethod === 'gps') {
        try {
          // Get user's location
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false,
            });
          });

          const { latitude, longitude } = position.coords;
          await fetchWeatherByCoords(latitude, longitude);
        } catch (error: any) {
          console.error('Geolocation error:', error);
          setWeatherError('Unable to get your location');
          setLoading(false);
        }
      } else if (settings.locationMethod === 'manual' && settings.manualLocation?.trim()) {
        await fetchWeatherByLocation(settings.manualLocation);
      } else if (settings.locationMethod === 'manual') {
        setLoading(false);
      } else {
        setWeatherError('Geolocation not available');
        setLoading(false);
      }
    };

    // Only fetch weather if geolocation is available (for GPS method)
    if (settings.locationMethod === 'gps' && navigator.geolocation) {
      fetchWeather();
    } else if (settings.locationMethod === 'manual' && settings.manualLocation?.trim()) {
      fetchWeather();
    } else if (settings.locationMethod === 'manual') {
      setLoading(false);
    } else {
      setWeatherError('Geolocation not available');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.locationMethod, settings.manualLocation, settings.temperatureUnit]);

  const getWeatherCondition = (code: number): string => {
    // WMO Weather interpretation codes
    const codes: { [key: number]: string } = {
      0: 'Clear',
      1: 'Mainly Clear',
      2: 'Partly Cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing Rime Fog',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Dense Drizzle',
      56: 'Light Freezing Drizzle',
      57: 'Dense Freezing Drizzle',
      61: 'Slight Rain',
      63: 'Moderate Rain',
      65: 'Heavy Rain',
      71: 'Slight Snow',
      73: 'Moderate Snow',
      75: 'Heavy Snow',
      77: 'Snow Grains',
      80: 'Slight Rain Showers',
      81: 'Moderate Rain Showers',
      82: 'Violent Rain Showers',
      85: 'Slight Snow Showers',
      86: 'Heavy Snow Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with Hail',
    };
    return codes[code] || 'Unknown';
  };

  const getWeatherIcon = (icon: string): string => {
    // Map OpenWeatherMap icons to emojis
    const iconMap: { [key: string]: string } = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌧️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️',
    };
    return iconMap[icon] || '🌤️';
  };

  if (compact) {
    // Compact version for widget card
    return (
      <div className="h-full flex flex-col items-center justify-center p-2">
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading...</div>
        ) : weather ? (
          <div
            key={weatherKey}
            className="flex flex-col items-center gap-1 opacity-0 animate-fadeIn"
          >
            <div className="text-2xl">{weather.icon}</div>
            <div className="flex items-center gap-1 text-base font-semibold text-foreground">
              <Thermometer className="h-3 w-3" />
              {weather.temperature}°{settings.temperatureUnit}
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {weather.condition}
            </div>
            <div className="text-xs text-muted-foreground text-center truncate w-full">
              {weather.location}
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center">
            {weatherError || (settings.locationMethod === 'manual' ? 'Enter location' : 'Weather unavailable')}
          </div>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div className="flex items-center gap-3">
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : weather ? (
        <div
          key={weatherKey}
          className="flex items-center gap-3 opacity-0 animate-fadeIn"
        >
          <div className="text-3xl">{weather.icon}</div>
          <div>
            <div className="flex items-center gap-1.5 text-base font-semibold text-foreground leading-tight">
              <Thermometer className="h-3.5 w-3.5" />
              {weather.temperature}°{settings.temperatureUnit}
            </div>
            <div className="text-xs text-muted-foreground">
              {weather.condition} • {weather.location}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {weatherError || (settings.locationMethod === 'manual' ? 'Enter location' : 'Weather unavailable')}
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;








