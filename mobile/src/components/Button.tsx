import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp, View } from 'react-native';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle
}) => {
  let btnBg = theme.colors.primary;
  let textColor = '#FFFFFF';
  let borderColor = 'transparent';

  switch (variant) {
    case 'primary':
      btnBg = theme.colors.primary;
      textColor = '#FFFFFF';
      break;
    case 'secondary':
      btnBg = theme.colors.primaryLight;
      textColor = '#FFFFFF';
      break;
    case 'outline':
      btnBg = 'transparent';
      textColor = theme.colors.primary;
      borderColor = theme.colors.primary;
      break;
    case 'danger':
      btnBg = theme.colors.danger;
      textColor = '#FFFFFF';
      break;
    case 'success':
      btnBg = theme.colors.success;
      textColor = '#FFFFFF';
      break;
  }

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        { backgroundColor: btnBg, borderColor },
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: 'transparent'
  },
  outline: {
    borderWidth: 1.5
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconContainer: {
    marginRight: 8
  },
  text: {
    fontSize: 15,
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.55
  }
});
