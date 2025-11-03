import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Thermometer, Cloud } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  icon?: string;
}

const WeatherTimeWidget: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        setWeatherError(null);

        // Get user's location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });

        const { latitude, longitude } = position.coords;

        // Use OpenWeatherMap API (free tier)
        // Note: In production, this should be proxied through the backend to hide API key
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
          
          setWeather({
            location: locationData.address?.city || locationData.address?.town || locationData.address?.village || 'Unknown',
            temperature: Math.round(data.current_weather.temperature),
            condition: getWeatherCondition(data.current_weather.weathercode),
            icon: '🌤️',
          });
        } else {
          // Use OpenWeatherMap if API key is provided
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`
          );
          
          if (!response.ok) throw new Error('Weather API failed');
          
          const data = await response.json();
          
          setWeather({
            location: data.name,
            temperature: Math.round(data.main.temp),
            condition: data.weather[0].main,
            icon: getWeatherIcon(data.weather[0].icon),
          });
        }
      } catch (error: any) {
        console.error('Weather fetch error:', error);
        setWeatherError('Unable to fetch weather data');
        // Set default location
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

    // Only fetch weather if geolocation is available
    if (navigator.geolocation) {
      fetchWeather();
    } else {
      setWeatherError('Geolocation not available');
      setLoading(false);
    }
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

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

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Time Section */}
          <div className="flex items-center gap-4">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-3xl font-mono font-semibold text-foreground">
                {formatTime(currentTime)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>

          {/* Weather Section */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="text-muted-foreground">Loading weather...</div>
            ) : weather ? (
              <>
                <div className="text-4xl">{weather.icon}</div>
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Thermometer className="h-4 w-4" />
                    {weather.temperature}°C
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {weather.condition}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    {weather.location}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                {weatherError || 'Weather unavailable'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherTimeWidget;

