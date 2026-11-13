import { toHex } from "@rsos/config/color";
import { ink, themes } from "@rsos/config/tokens";

/** Quiet map styles built from the ink tokens, so markers and routes stand out ("calm under stress"). */
type Style = google.maps.MapTypeStyle;
const hex = toHex;

const quiet: Style[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export const lightMapStyle: Style[] = [
  ...quiet,
  { elementType: "geometry", stylers: [{ color: hex(ink[100]) }] },
  { elementType: "labels.text.fill", stylers: [{ color: hex(ink[600]) }] },
  { elementType: "labels.text.stroke", stylers: [{ color: hex(ink[50]) }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: hex(themes.light.surface!) }],
  },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: hex(ink[200]) }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: hex(themes.light["info-subtle"]!) }],
  },
];

export const darkMapStyle: Style[] = [
  ...quiet,
  { elementType: "geometry", stylers: [{ color: hex(ink[900]) }] },
  { elementType: "labels.text.fill", stylers: [{ color: hex(ink[400]) }] },
  { elementType: "labels.text.stroke", stylers: [{ color: hex(ink[950]) }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: hex(ink[800]) }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: hex(ink[700]) }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: hex(themes.dark["info-subtle"]!) }],
  },
];
