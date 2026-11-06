import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Choice, H2, Loading, Screen, Small } from "../../../components/ui";
import { FilterChips } from "../../../components/cases";
import { api, ApiError, type BulletinArea, type BulletinResponse, type BulletinWatch } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { space } from "../../../lib/theme";

/** Choose the Visa Bulletin category, country and chart to follow. */
export default function BulletinWatchScreen() {
  const { t, lang } = useAuth();
  const [data, setData] = useState<BulletinResponse | null>(null);
  const [choice, setChoice] = useState<BulletinWatch>({ category: "F2A", area: "ALL", chart: "final" });
  const [busy, setBusy] = useState<"save" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<BulletinResponse>("/api/v1/visa-bulletin")
      .then((r) => {
        setData(r);
        if (r.watch) setChoice(r.watch);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, []);

  if (!data && !error) return <Loading />;
  const cats = data?.catalog.categories ?? [];

  async function run(kind: "save" | "stop") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "save") await api("/api/v1/visa-bulletin/watch", { method: "PUT", body: choice });
      else await api("/api/v1/visa-bulletin/watch", { method: "DELETE" });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <Screen>
      {error && <Banner tone="danger">{error}</Banner>}
      {(["family", "employment"] as const).map((kind) => (
        <View key={kind} style={{ gap: space(2) }}>
          <H2>{kind === "family" ? t.familyCategories : t.employmentCategories}</H2>
          {cats
            .filter((x) => x.kind === kind)
            .map((x) => (
              <Choice key={x.key} selected={choice.category === x.key} onPress={() => setChoice((c) => ({ ...c, category: x.key }))} title={x.code} body={x[lang]} />
            ))}
        </View>
      ))}
      <View style={{ gap: space(2) }}>
        <H2>{t.chargeability}</H2>
        <FilterChips<BulletinArea> value={choice.area} onChange={(a) => setChoice((c) => ({ ...c, area: a }))} options={(data?.catalog.areas ?? []).map((a) => ({ key: a.key, label: a[lang] }))} />
      </View>
      <View style={{ gap: space(2) }}>
        <H2>{t.chartFirst}</H2>
        <Choice selected={choice.chart === "final"} onPress={() => setChoice((c) => ({ ...c, chart: "final" }))} title={t.finalShort} body={t.finalExplain} />
        <Choice selected={choice.chart === "filing"} onPress={() => setChoice((c) => ({ ...c, chart: "filing" }))} title={t.filingShort} body={t.filingExplain} />
      </View>
      <Small>{data?.alerts ? t.bulletinAlertsOn : t.bulletinAlertsPremium}</Small>
      <Button title={t.save} onPress={() => run("save")} loading={busy === "save"} />
      {data?.watch && <Button title={t.stopFollowing} variant="secondary" onPress={() => run("stop")} loading={busy === "stop"} />}
    </Screen>
  );
}
