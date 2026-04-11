/**
 * Evidence Upload Screen
 * Camera / gallery capture → S3 upload → record evidence on task
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { TaskStackParamList } from "../../navigation/types";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";
import { Button, Card, Loading } from "../../components/common";
import { uploadEvidenceFile } from "../../api/evidenceService";
import { useToast } from "../../context/ToastContext";

type EvidenceUploadRouteProp = RouteProp<TaskStackParamList, "EvidenceUpload">;

export const EvidenceUploadScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<EvidenceUploadRouteProp>();
  const { taskId } = route.params;
  const { showToast } = useToast();

  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    mimeType: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"loading" | "ok" | "denied">(
    "loading",
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        ...animation.spring.gentle,
        useNativeDriver: true,
      }),
    ]).start();

    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("denied");
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGps({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setGpsStatus("ok");
    } catch {
      setGpsStatus("denied");
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showToast({
        message: "Camera access required. Enable it in device settings.",
        variant: "warning",
      });
      return false;
    }
    return true;
  };

  const requestMediaPermission = async (): Promise<boolean> => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast({
        message: "Photo library access required. Enable it in device settings.",
        variant: "warning",
      });
      return false;
    }
    return true;
  };

  const handleTakePhoto = useCallback(async () => {
    const granted = await requestCameraPermission();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }, []);

  const handleChooseFromLibrary = useCallback(async () => {
    const granted = await requestMediaPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.85,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setSelectedImage({
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedImage) {
      showToast({ message: "Please take or select a photo first.", variant: "warning" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadEvidenceFile(
        taskId,
        selectedImage.uri,
        selectedImage.mimeType,
        notes.trim() || undefined,
        gps?.latitude,
        gps?.longitude,
        setUploadProgress,
      );

      showToast({ message: "Evidence uploaded successfully.", variant: "success" });
      navigation.goBack();
    } catch (err: any) {
      showToast({
        message: err?.message || "Upload failed. Please try again.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}
      >
        {/* Photo selection area */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Photo</Text>

          {selectedImage ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.changePhotoBtn}
                onPress={() => setSelectedImage(null)}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={24}
                  color={colors.destructive}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.pickersRow}>
              <TouchableOpacity
                style={[styles.pickerBtn, shadows.sm]}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pickerGradient}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={32}
                    color={colors.primaryForeground}
                  />
                  <Text style={styles.pickerLabel}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnOutline, shadows.sm]}
                onPress={handleChooseFromLibrary}
                activeOpacity={0.8}
              >
                <View style={styles.pickerOutlineInner}>
                  <MaterialCommunityIcons
                    name="image-multiple"
                    size={32}
                    color={colors.primary}
                  />
                  <Text style={[styles.pickerLabel, { color: colors.primary }]}>
                    Choose from Library
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {/* GPS status */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.gpsRow}>
            <View
              style={[
                styles.gpsIcon,
                {
                  backgroundColor:
                    gpsStatus === "ok"
                      ? colors.success + "18"
                      : gpsStatus === "loading"
                        ? colors.warning + "18"
                        : colors.muted,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  gpsStatus === "ok"
                    ? "crosshairs-gps"
                    : gpsStatus === "loading"
                      ? "loading"
                      : "crosshairs-off"
                }
                size={20}
                color={
                  gpsStatus === "ok"
                    ? colors.success
                    : gpsStatus === "loading"
                      ? colors.warning
                      : colors.textSecondary
                }
              />
            </View>
            <Text style={styles.gpsText}>
              {gpsStatus === "loading"
                ? "Acquiring GPS…"
                : gpsStatus === "ok" && gps
                  ? `${gps.latitude.toFixed(5)}° N, ${gps.longitude.toFixed(5)}° E`
                  : "GPS unavailable — evidence will be submitted without coordinates"}
            </Text>
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe what was done, observations, etc."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            editable={!uploading}
          />
        </Card>

        {/* Upload progress */}
        {uploading && (
          <Card style={styles.section}>
            <View style={styles.progressRow}>
              <MaterialCommunityIcons
                name="cloud-upload-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.progressLabel}>
                {uploadProgress < 100
                  ? `Uploading… ${uploadProgress}%`
                  : "Saving evidence…"}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress}%` as any },
                ]}
              />
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={uploading ? (uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Saving…") : "Submit Evidence"}
            onPress={handleSubmit}
            loading={uploading}
            disabled={!selectedImage || uploading}
            variant="gradient"
            icon="cloud-upload"
            size="large"
          />
          <Button
            title="Cancel"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="large"
            disabled={uploading}
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  // Photo pickers
  pickersRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  pickerBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  pickerBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pickerGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  pickerOutlineInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  pickerLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primaryForeground,
    textAlign: "center",
  },
  // Preview
  previewContainer: {
    position: "relative",
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: borderRadius.xl,
  },
  changePhotoBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
  },
  // GPS
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  gpsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Notes
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text,
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: colors.background,
  },
  // Progress
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  // Actions
  actions: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
