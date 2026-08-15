import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  ImageBackground,
  Dimensions,
  Platform,
  Image,
} from "react-native";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { images } from "@/constants";
import { Redirect, Slot } from "expo-router";
import useAuthStore from "@/store/auth.store";

const _layout = () => {
  const {isAuthenticated}=useAuthStore();

  if(isAuthenticated) return <Redirect href="/" />
  
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="bg-white h-full"
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full relative"
          style={{ height: Dimensions.get("screen").height / 2.25 }}
        >
          <ImageBackground
            source={images.loginGraphic}
            className="size-full rounded-b-lg"
            resizeMode="stretch"
          />
          <Image
            source={images.logo}
            className="self-center size-48 absolute -bottom-16 z-10"
          />
        </View>

        <Slot />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default _layout;
