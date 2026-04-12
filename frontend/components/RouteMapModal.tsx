import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { apiGet } from "../lib/api";
import { colors, fonts, radius, space, shadow } from "../lib/theme";

// Native-only WebView wrapper (not imported on web)
function WebViewMap({ html }: { html: string }) {
  if (Platform.OS === "web") return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");
  return (
    <WebView
      source={{ html }}
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}

type RoutePoint = { lat: number; lng: number; timestamp: string };
type WindowLabel = { predicted_label: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  windows?: WindowLabel[];
};

export default function RouteMapModal({ visible, onClose, sessionId, windows }: Props) {
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState<RoutePoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !sessionId) return;
    setLoading(true);
    setError(null);
    apiGet(`/sessions/${sessionId}/route`)
      .then((data: any) => {
        const pts = data?.route;
        if (Array.isArray(pts) && pts.length > 0) {
          setRoute(pts);
        } else {
          setError("No route data available");
        }
      })
      .catch((e: any) => setError(e?.message || "Failed to load route"))
      .finally(() => setLoading(false));
  }, [visible, sessionId]);

  const mapHtml = route
    ? `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
html,body{margin:0;padding:0;height:100%;overflow:hidden;}
#map{width:100%;height:100%;}
.leaflet-control-attribution{font-size:9px!important;}
</style>
</head>
<body>
<div id="map"></div>
<script>
var route=${JSON.stringify(route.map((p) => [p.lat, p.lng]))};
var map=L.map('map',{zoomControl:true,attributionControl:true});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap',maxZoom:19
}).addTo(map);
var line=L.polyline(route,{color:'#4285F4',weight:5,opacity:0.9,smoothFactor:1.5}).addTo(map);
L.circleMarker(route[0],{radius:6,color:'#fff',fillColor:'#222',fillOpacity:1,weight:1.5}).addTo(map).bindPopup('Start');
L.marker(route[route.length-1],{icon:L.divIcon({className:'',html:'<div style=\"width:12px;height:12px;background:#222;border:1.5px solid #fff;border-radius:2px;\"><\/div>',iconSize:[12,12],iconAnchor:[6,6]})}).addTo(map).bindPopup('End');
var wins=${JSON.stringify((windows || []).map(w => w.predicted_label))};
if(wins.length>0&&route.length>1){
  var segLen=Math.floor(route.length/wins.length);
  for(var i=0;i<wins.length;i++){
    if(wins[i]==='Normal')continue;
    var mid=Math.min(Math.floor(segLen*i+segLen/2),route.length-1);
    var col=wins[i]==='Aggressive'?'#FF4444':'#FF9800';
    var lbl=wins[i]==='Aggressive'?'Aggressive (Window '+(i+1)+')':'Drowsy (Window '+(i+1)+')';
    L.circleMarker(route[mid],{radius:6,color:'#fff',fillColor:col,fillOpacity:0.85,weight:1.5}).addTo(map).bindPopup(lbl);
  }
}
map.fitBounds(line.getBounds(),{padding:[40,40]});
<\/script>
</body>
</html>`
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Session Route</Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Content */}
          <View style={s.mapContainer}>
            {loading ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color={colors.blue} />
                <Text style={s.loadingText}>Loading route…</Text>
              </View>
            ) : error ? (
              <View style={s.center}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : Platform.OS === "web" ? (
              <iframe
                srcDoc={mapHtml}
                style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
              />
            ) : (
              <WebViewMap html={mapHtml} />
            )}
          </View>

          {/* Legend */}
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#222", borderWidth: 2, borderColor: "rgba(0,0,0,0.3)" }]} />
              <Text style={s.legendText}>Start</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendSquare]} />
              <Text style={s.legendText}>End</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendLine, { backgroundColor: "#4285F4" }]} />
              <Text style={s.legendText}>Route</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#FF4444" }]} />
              <Text style={s.legendText}>Aggressive</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: "#FF9800" }]} />
              <Text style={s.legendText}>Drowsy</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 700,
    height: "80%",
    maxHeight: 600,
    backgroundColor: colors.cardBg,
    borderRadius: radius.cardLg,
    overflow: "hidden",
    ...shadow.cardRaised,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderFaint,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.extrabold,
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.pageBg,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    color: colors.subtext,
    fontFamily: fonts.bold,
  },
  mapContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.subtext,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.red,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderFaint,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: "#222",
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.subtext,
  },
});
