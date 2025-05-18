import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  View
} from 'react-native';
import styles from './styles';

const SignupScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = () => {
    if (username.length < 3 || password.length < 4) {
      Alert.alert('Weak Input', 'Username must be at least 3 characters and password at least 4.');
      return;
    }

    Alert.alert('Success', `Account created for ${username}`);
    navigation.navigate('Login');
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

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>Already have an account? Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SignupScreen;
