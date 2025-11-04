import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Thermometer, Cloud, Settings, Search, Navigation } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

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
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual'>('gps');
  const [manualLocation, setManualLocation] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [weatherKey, setWeatherKey] = useState(0); // Key for fade animation

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch weather data by coordinates
  const fetchWeatherByCoords = async (latitude: number, longitude: number) => {
    try {
      setLoading(true);
      setWeatherError(null);

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
        setWeatherKey(prev => prev + 1); // Trigger fade animation
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
        setWeatherKey(prev => prev + 1); // Trigger fade animation
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

  // Fetch weather data by location name
  const fetchWeatherByLocation = async (location: string) => {
    try {
      setLoading(true);
      setWeatherError(null);
      setIsSearchingLocation(true);

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
      setWeatherKey(prev => prev + 1); // Trigger fade animation
    } catch (error: any) {
      console.error('Weather fetch error:', error);
      setWeatherError(error.message || 'Unable to fetch weather data');
      setWeather({
        location: manualLocation || 'Unknown Location',
        temperature: 0,
        condition: 'Unknown',
        icon: '❓',
      });
    } finally {
      setLoading(false);
      setIsSearchingLocation(false);
    }
  };

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      if (locationMethod === 'gps') {
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
      } else if (locationMethod === 'manual' && manualLocation.trim()) {
        await fetchWeatherByLocation(manualLocation);
      }
    };

    // Only fetch weather if geolocation is available (for GPS method)
    if (locationMethod === 'gps' && navigator.geolocation) {
      fetchWeather();
    } else if (locationMethod === 'manual' && manualLocation.trim()) {
      fetchWeather();
    } else if (locationMethod === 'manual') {
      setLoading(false);
    } else {
      setWeatherError('Geolocation not available');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationMethod]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat === '12h',
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

  const handleManualLocationSubmit = async () => {
    if (manualLocation.trim()) {
      await fetchWeatherByLocation(manualLocation);
    }
  };

                   return (
      <Card className="mb-6 bg-transparent border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 max-w-4xl">
            {/* Main Content Row: Time, Settings, Weather */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Time Section */}
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <div className="text-2xl font-mono font-semibold text-foreground leading-tight">
                    {formatTime(currentTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(currentTime)}
                  </div>
                </div>
              </div>

              {/* Settings Button - between time and weather */}
              <div className="flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* Weather Section - next to settings */}
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
                        {weather.temperature}°C
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {weather.condition} • {weather.location}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {weatherError || (locationMethod === 'manual' ? 'Enter location' : 'Weather unavailable')}
                  </div>
                )}
              </div>
            </div>

          {/* Settings Panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showSettings ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="pt-2 px-2 pb-2 bg-muted/50 rounded-lg space-y-3">
              {/* Time Format Setting */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Time Format
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={timeFormat === '12h' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeFormat('12h')}
                    className="h-7 text-xs"
                  >
                    12 Hour
                  </Button>
                  <Button
                    variant={timeFormat === '24h' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeFormat('24h')}
                    className="h-7 text-xs"
                  >
                    24 Hour
                  </Button>
                </div>
              </div>

              {/* Location Method Setting */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Location Method
                </label>
                <div className="flex gap-2 mb-2">
                  <Button
                    variant={locationMethod === 'gps' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocationMethod('gps')}
                    className="h-7 text-xs"
                  >
                    <Navigation className="h-3 w-3 mr-1.5" />
                    GPS
                  </Button>
                  <Button
                    variant={locationMethod === 'manual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLocationMethod('manual')}
                    className="h-7 text-xs"
                  >
                    <Search className="h-3 w-3 mr-1.5" />
                    Manual
                  </Button>
                </div>
                {locationMethod === 'manual' && (
                  <div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter city name"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleManualLocationSubmit();
                          }
                        }}
                        className="flex-1 text-foreground h-7 text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={handleManualLocationSubmit}
                        disabled={!manualLocation.trim() || isSearchingLocation}
                        className="h-7 text-xs"
                      >
                        {isSearchingLocation ? '...' : 'Search'}
                      </Button>
                    </div>
                    <p className="text-xs text-foreground mt-1.5">
                      Tip: Add country code (e.g., "Athens, Gr")
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherTimeWidget;

