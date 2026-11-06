import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Easing
} from 'react-native';
import { theme } from '../theme';

interface LoadingScreenProps {
  pageName?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ pageName }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Continuous smooth rotation for the circle rounding the logo
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    // 2. Subtle pulsing for the logo
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseValue, {
          toValue: 0.95,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <View style={styles.centerBox}>
        {/* Spinner & Logo Area */}
        <View style={styles.logoRingWrapper}>
          {/* Animated Circle Rounding the Logo */}
          <Animated.View
            style={[
              styles.spinningRing,
              { transform: [{ rotate: spin }] }
            ]}
          />

          {/* Logo Appears Small at Centre */}
          <Animated.View
            style={[
              styles.logoContainer,
              { transform: [{ scale: pulseValue }] }
            ]}
          >
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Brand Title & Loading Subtext */}
        <Text style={styles.brandTitle}>UniSoft Team</Text>
        <Text style={styles.loadingText}>
          {pageName ? `Loading ${pageName}...` : 'Loading, please wait...'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoRingWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  spinningRing: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3.5,
    borderColor: '#E2E8F0',
    borderTopColor: '#1D4ED8',      // Primary Blue
    borderRightColor: '#EA580C'     // Brand Orange matching the logo ring
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  logoImage: {
    width: 58,
    height: 58
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500'
  }
});
