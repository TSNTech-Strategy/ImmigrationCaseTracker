import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useAuth } from "../../../lib/auth";
import { useTheme } from "../../../lib/theme";

/** Bottom tabs: the system tab bar on each platform (floating glass on iOS 26). */
export default function TabsLayout() {
  const { t } = useAuth();
  const { c } = useTheme();
  return (
    // The web preview's tab bar has a dark selected pill, so its selected label is white there.
    <NativeTabs tintColor={Platform.OS === "web" ? "#FFFFFF" : c.accent} backgroundColor={c.surface} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="cases">
        <NativeTabs.Trigger.Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} md="description" />
        <NativeTabs.Trigger.Label>{t.tabCases}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bulletin">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} md="calendar_month" />
        <NativeTabs.Trigger.Label>{t.tabBulletin}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resources">
        <NativeTabs.Trigger.Icon sf={{ default: "book", selected: "book.fill" }} md="menu_book" />
        <NativeTabs.Trigger.Label>{t.tabResources}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
        <NativeTabs.Trigger.Label>{t.tabSettings}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
