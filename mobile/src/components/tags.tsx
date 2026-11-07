import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { createTag, listTags, setCaseTags, tagTone, TAG_COLORS, TAG_NAME_MAX, type Tag, type TagColor } from "../lib/tags";
import { space, useTheme } from "../lib/theme";
import { Icon } from "./icon";
import { Banner, Button, Card, Field, Small } from "./ui";

/** A tag's colored dot. */
export function TagDot({ color, size = 8 }: { color: TagColor; size?: number }) {
  const { c, isDark } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tagTone(c, isDark, color).fg }} />;
}

/**
 * A tag: a dot and the name on an outlined chip, so it never looks like the
 * filled status pills. Selected chips take the tag's soft color.
 */
export function TagChip({
  tag,
  small,
  selected,
  count,
  onPress,
  label,
}: {
  tag: Pick<Tag, "name" | "color">;
  small?: boolean;
  selected?: boolean;
  count?: number;
  onPress?: () => void;
  /** Read out instead of the name (e.g. "Family, on this case"). */
  label?: string;
}) {
  const { c, isDark } = useTheme();
  const tone = tagTone(c, isDark, tag.color);
  const body = (
    <>
      <TagDot color={tag.color} size={small ? 7 : 9} />
      <Text numberOfLines={1} style={{ color: selected ? tone.fg : c.text, fontWeight: "600", fontSize: small ? 12 : 14, maxWidth: small ? 140 : 200 }}>
        {tag.name}
      </Text>
      {count !== undefined && <Text style={{ color: selected ? tone.fg : c.muted, fontWeight: "600", fontSize: small ? 12 : 13 }}>{count}</Text>}
      {selected && !small && onPress && <Icon ios="checkmark" md="check" size={13} color={tone.fg} fallback="✓" />}
    </>
  );
  const style = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: small ? space(1.25) : space(1.5),
    paddingHorizontal: small ? space(2) : space(3),
    minHeight: small ? 24 : 36,
    borderRadius: small ? 12 : 18,
    backgroundColor: selected ? tone.bg : c.surface,
    borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth * 2,
    borderColor: selected ? tone.fg : c.border,
  };
  if (!onPress) {
    return (
      <View accessibilityLabel={label ?? tag.name} style={style}>
        {body}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" aria-selected={selected} accessibilityLabel={label ?? tag.name} onPress={onPress} hitSlop={4} style={({ pressed }) => [style, pressed && { opacity: 0.75 }]}>
      {body}
    </Pressable>
  );
}

/** A dashed "+ New tag" chip (or "Manage tags", with a pencil). */
export function NewTagChip({ label, onPress, edit }: { label: string; onPress: () => void; edit?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space(1),
        paddingHorizontal: space(3),
        minHeight: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: c.border,
        backgroundColor: pressed ? c.surface2 : "transparent",
      })}
    >
      {edit ? <Icon ios="pencil" md="edit" size={13} color={c.accent} fallback="✎" /> : <Icon ios="plus" md="add" size={14} color={c.accent} fallback="+" />}
      <Text style={{ color: c.accent, fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Small tag chips for a case card (the first few, then "+2"). */
export function CardTags({ tags, max = 3 }: { tags: Tag[]; max?: number }) {
  const { c } = useTheme();
  if (!tags.length) return null;
  const extra = tags.length - max;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1.5), marginTop: space(0.5) }}>
      {tags.slice(0, max).map((tg) => (
        <TagChip key={tg.id} tag={tg} small />
      ))}
      {extra > 0 && <Text style={{ alignSelf: "center", color: c.muted, fontSize: 12, fontWeight: "600" }}>+{extra}</Text>}
    </View>
  );
}

/** The six tag colors as round swatches. */
export function ColorPicker({ value, onChange }: { value: TagColor; onChange: (color: TagColor) => void }) {
  const { t } = useAuth();
  const { c, isDark } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t.tagColor} style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2.5) }}>
      {TAG_COLORS.map((color) => {
        const on = color === value;
        const tone = tagTone(c, isDark, color);
        return (
          <Pressable
            key={color}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={t.colorNames[color]}
            onPress={() => onChange(color)}
            hitSlop={4}
            style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: on ? tone.fg : "transparent" }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tone.fg, alignItems: "center", justifyContent: "center" }}>
              {on && <Icon ios="checkmark" md="check" size={13} color={isDark ? c.background : "#FFFFFF"} fallback="✓" />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name);

/**
 * The case screen's Tags card: every tag as a chip (tap to put it on this case
 * or take it off), and "New tag" to make one and put it on right away.
 */
export function CaseTags({ caseId, value, onChange }: { caseId: string; value: Tag[]; onChange: (tags: Tag[]) => void }) {
  const { t } = useAuth();
  const { c } = useTheme();
  const [all, setAll] = useState<Tag[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Again when coming back from Manage tags.
  useFocusEffect(
    useCallback(() => {
      listTags()
        .then((r) => setAll(r.tags))
        .catch(() => setAll((a) => a ?? []));
    }, []),
  );

  const on = new Set(value.map((x) => x.id));
  const message = (e: unknown) => (e instanceof ApiError ? e.message : String(e));

  async function toggle(tag: Tag) {
    const next = on.has(tag.id) ? value.filter((x) => x.id !== tag.id) : [...value, tag].sort(byName);
    setError(null);
    onChange(next);
    try {
      onChange((await setCaseTags(caseId, next.map((x) => x.id))).tags);
    } catch (e) {
      onChange(value);
      setError(message(e));
    }
  }

  async function add() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { tag } = await createTag(n);
      setAll((a) => [...(a ?? []), tag].sort(byName));
      onChange((await setCaseTags(caseId, [...value.map((x) => x.id), tag.id])).tags);
      setName("");
      setAdding(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) }}>
        <Small style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "600", fontSize: 12 }}>{t.tags}</Small>
        {Boolean(all?.length) && (
          <Pressable accessibilityRole="link" onPress={() => router.push("/tags")} hitSlop={8}>
            <Text style={{ color: c.accent, fontWeight: "600", fontSize: 14 }}>{t.manageTags}</Text>
          </Pressable>
        )}
      </View>
      <Small>{all?.length ? t.tagsOnCase : t.tagsHelp}</Small>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
        {(all ?? []).map((tag) => (
          <TagChip key={tag.id} tag={tag} selected={on.has(tag.id)} onPress={() => toggle(tag)} label={on.has(tag.id) ? t.tagOnCase(tag.name) : t.tagOffCase(tag.name)} />
        ))}
        {!adding && all !== null && <NewTagChip label={t.newTag} onPress={() => setAdding(true)} />}
      </View>
      {adding && (
        <View style={{ gap: space(2) }}>
          <Field label={t.tagName} value={name} onChangeText={setName} placeholder={t.tagNamePlaceholder} maxLength={TAG_NAME_MAX} autoFocus returnKeyType="done" onSubmitEditing={add} />
          <View style={{ flexDirection: "row", gap: space(2) }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t.cancel}
                variant="secondary"
                onPress={() => {
                  setAdding(false);
                  setName("");
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={t.addTag} onPress={add} loading={busy} disabled={!name.trim()} />
            </View>
          </View>
        </View>
      )}
      {error && <Banner tone="danger">{error}</Banner>}
    </Card>
  );
}
