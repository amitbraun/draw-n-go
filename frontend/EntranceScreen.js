import React, { useEffect, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  View
} from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import styles from './styles';
import logo from '../assets/logo.png'; // ✅ your running man icon

const API_KEY =
  Constants.expoConfig?.extra?.WEATHER_API_KEY ||
  Constants.manifest?.extra?.WEATHER_API_KEY;

const EntranceScreen = ({ navigation }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location permission is required to fetch weather.');
          setLoading(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`
        );
        const data = await res.json();

        if (data.cod === 200) {
          setWeather({
            temp: data.main.temp,
            condition: data.weather[0].main,
            description: data.weather[0].description,
            icon: data.weather[0].icon,
            city: data.name,
          });
        } else {
          console.error('Weather API error:', data.message);
        }
      } catch (error) {
        console.error('Failed to load weather:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const getPlayRecommendation = (temp, condition) => {
    if (temp > 32 || temp < 12 || ['Rain', 'Thunderstorm', 'Snow'].includes(condition)) {
      return '☁️ Better to stay inside.';
    }
    return '☀️ Great for outdoor play!';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header title with logo */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Draw & Go</Text>
          <Image source={logo} style={styles.titleIcon} resizeMode="contain" />
        </View>

        <View style={styles.mainContent}>
          {loading ? (
            <ActivityIndicator size="large" color="#888" />
          ) : weather ? (
            <View style={styles.weatherCard}>
              <Text style={styles.weatherTitle}>{weather.city} Weather</Text>
              <Image
                source={{ uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png` }}
                style={styles.weatherIcon}
              />
              <Text style={styles.weatherTemp}>{weather.temp.toFixed(1)}°C</Text>
              <Text style={styles.weatherDescription}>{weather.description}</Text>
              <Text style={styles.weatherRecommendation}>
                {getPlayRecommendation(weather.temp, weather.condition)}
              </Text>
            </View>
          ) : (
            <Text style={styles.placeholderText}>Weather unavailable</Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EntranceScreen;
