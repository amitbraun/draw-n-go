import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  View
} from 'react-native';
import styles from './styles';

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignup = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (username.length < 3 || password.length < 4) {
      setErrorMessage('Username must be at least 3 characters and password at least 4.');
      return;
    }

    try {
      const response = await fetch('https://draw-n-go.azurewebsites.net/api/signUp?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();
      if (response.status === 201) {
        setSuccessMessage(`Account created for ${username}`);
        navigation.navigate('Login');
      } else {
        setErrorMessage(text);
      }
    } catch (err) {
      setErrorMessage('Could not connect to server.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Sign Up</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Create an Account</Text>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleSignup}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>

          {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}
          {successMessage !== '' && <Text style={styles.success}>{successMessage}</Text>}

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignupScreen;
