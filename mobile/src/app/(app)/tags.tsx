import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../../components/icon";
import { ColorPicker, TagDot } from "../../components/tags";
import { Banner, Button, Card, Field, Screen, Small } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { createTag, deleteTag, listTags, updateTag, TAG_COLORS, TAG_NAME_MAX, TAGS_PER_PERSON, type TagColor, type TagWithCount } from "../../lib/tags";
import { radius, space, useTheme } from "../../lib/theme";

const message = (e: unknown) => (e instanceof ApiError ? e.message : String(e));

/** The least-used color, so a new tag looks different from the others. */
function nextColor(tags: TagWithCount[]): TagColor {
  const used = (color: TagColor) => tags.filter((x) => x.color === color).length;
  return [...TAG_COLORS].sort((a, b) => used(a) - used(b))[0];
}

/** Manage tags: add one (name and color), rename, recolor, delete. */
export default function TagsScreen() {
  const { t } = useAuth();
  const { c } = useTheme();
  const [tags, setTags] = useState<TagWithCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTags((await listTags()).tags);
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const chosen = useMemo(() => color ?? nextColor(tags ?? []), [color, tags]);
  const full = (tags?.length ?? 0) >= TAGS_PER_PERSON;

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    if (!name.trim() || busy) return;
    if (await run("add", () => createTag(name.trim(), chosen))) {
      setName("");
      setColor(null);
    }
  }

  return (
    <Screen>
      <Small>{t.tagsHelp}</Small>
      <Card>
        <Field label={t.newTag} value={name} onChangeText={setName} placeholder={t.tagNamePlaceholder} maxLength={TAG_NAME_MAX} returnKeyType="done" onSubmitEditing={add} editable={!full} />
        <View style={{ gap: space(2) }}>
          <Small muted={false} style={{ fontWeight: "600" }}>
            {t.tagColor}
          </Small>
          <ColorPicker value={chosen} onChange={setColor} />
        </View>
        <Button title={t.addTag} onPress={add} loading={busy === "add"} disabled={!name.trim() || full} icon={{ ios: "plus", md: "add", fallback: "+" }} />
        <Small>{t.tagsLimit(TAGS_PER_PERSON)}</Small>
      </Card>

      {error && <Banner tone="danger">{error}</Banner>}
      {tags?.length === 0 && <Small style={{ textAlign: "center" }}>{t.noTagsYet}</Small>}

      {Boolean(tags?.length) && (
        <View style={{ backgroundColor: c.surface, borderRadius: radius.lg + 2, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }}>
          {tags!.map((tag, i) => (
            <View key={tag.id}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: space(4) }} />}
              <View style={{ paddingHorizontal: space(4), paddingVertical: space(3), gap: space(3) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
                  <TagDot color={tag.color} size={12} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }} numberOfLines={1}>
                      {tag.name}
                    </Text>
                    <Text style={{ fontSize: 13, color: c.muted }}>{t.tagCases(tag.caseCount)}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.renameTag}: ${tag.name}`}
                    hitSlop={8}
                    onPress={() => {
                      setConfirming(null);
                      setEditing(editing?.id === tag.id ? null : { id: tag.id, name: tag.name });
                    }}
                    style={{ padding: space(1.5) }}
                  >
                    <Icon ios="pencil" md="edit" size={17} color={c.accent} fallback="✎" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.deleteTag}: ${tag.name}`}
                    hitSlop={8}
                    onPress={() => {
                      setEditing(null);
                      setConfirming(confirming === tag.id ? null : tag.id);
                    }}
                    style={{ padding: space(1.5) }}
                  >
                    <Icon ios="trash" md="delete" size={17} color={c.danger} fallback="✕" />
                  </Pressable>
                </View>

                {editing?.id === tag.id && (
                  <View style={{ gap: space(3) }}>
                    <Field label={t.tagName} value={editing.name} onChangeText={(v) => setEditing({ id: tag.id, name: v })} maxLength={TAG_NAME_MAX} autoFocus />
                    <ColorPicker value={tag.color} onChange={(next) => run(`color-${tag.id}`, () => updateTag(tag.id, { color: next }))} />
                    <View style={{ flexDirection: "row", gap: space(2) }}>
                      <View style={{ flex: 1 }}>
                        <Button title={t.cancel} variant="secondary" onPress={() => setEditing(null)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title={t.save}
                          loading={busy === `name-${tag.id}`}
                          disabled={!editing.name.trim() || editing.name.trim() === tag.name}
                          onPress={async () => {
                            if (await run(`name-${tag.id}`, () => updateTag(tag.id, { name: editing.name.trim() }))) setEditing(null);
                          }}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {confirming === tag.id && (
                  <View style={{ gap: space(3) }}>
                    <Text style={{ fontSize: 15, color: c.text }}>{t.deleteTagQ(tag.name, tag.caseCount)}</Text>
                    <View style={{ flexDirection: "row", gap: space(2) }}>
                      <View style={{ flex: 1 }}>
                        <Button title={t.cancel} variant="secondary" onPress={() => setConfirming(null)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title={t.deleteTag}
                          variant="danger"
                          loading={busy === `delete-${tag.id}`}
                          onPress={async () => {
                            if (await run(`delete-${tag.id}`, () => deleteTag(tag.id))) setConfirming(null);
                          }}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
