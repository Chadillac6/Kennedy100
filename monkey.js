// Monkey mascot drawn in SVG. style: "A" classic, "B" banana buddy, "C" headphones listener
function monkeySVG(style, pose = "wave") {
  const P = {
    A: { fur: "#8A5A35", dark: "#6B4226", face: "#F3D2A8", acc: "" },
    B: { fur: "#D9822B", dark: "#B4651A", face: "#FBE3BE", acc: "" },
    C: { fur: "#7B5B4A", dark: "#5E4334", face: "#F6D9BD", acc: "" },
  }[style];
  const { fur, dark, face } = P;
  const armL = pose === "wave"
    ? `<g class="arm-wave"><path d="M60 150 Q34 128 34 96" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="34" cy="92" r="13" fill="${face}"/></g>`
    : pose === "cheer"
      ? `<path d="M60 146 Q30 120 32 88" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="32" cy="84" r="13" fill="${face}"/>`
      : `<path d="M60 150 Q46 172 58 190" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="60" cy="192" r="12" fill="${face}"/>`;
  const armR = pose === "cheer"
    ? `<path d="M140 146 Q170 120 168 88" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="168" cy="84" r="13" fill="${face}"/>`
    : `<path d="M140 150 Q154 172 142 190" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/><circle cx="140" cy="192" r="12" fill="${face}"/>`;
  const banana = style === "B"
    ? `<g transform="rotate(-20 150 186)"><path d="M128 196 Q150 206 176 180 Q170 178 166 182 Q150 196 132 190 Z" fill="#FFD43B" stroke="#C99A00" stroke-width="3" stroke-linejoin="round"/><path d="M174 181 l6 -6" stroke="#6B4E00" stroke-width="4" stroke-linecap="round"/></g>`
    : "";
  const bandana = style === "A"
    ? `<path d="M52 128 Q100 150 148 128 L150 140 Q100 164 50 140 Z" fill="#2FB36B"/><path d="M114 146 L126 176 L112 172 L106 150 Z" fill="#23864F"/>`
    : "";
  const phones = style === "C"
    ? `<path d="M38 86 Q38 14 100 14 Q162 14 162 86" stroke="#FF5D8F" stroke-width="10" fill="none" stroke-linecap="round"/>
       <rect x="22" y="70" width="26" height="40" rx="11" fill="#FF5D8F"/><rect x="152" y="70" width="26" height="40" rx="11" fill="#FF5D8F"/>
       <rect x="28" y="78" width="12" height="24" rx="6" fill="#FFC2D4"/><rect x="160" y="78" width="12" height="24" rx="6" fill="#FFC2D4"/>`
    : "";
  return `<svg viewBox="0 0 200 230" role="img" aria-label="the monkey">
    <path d="M140 196 C190 200 196 140 168 128 C150 120 140 144 158 152" stroke="${dark}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <ellipse cx="100" cy="170" rx="48" ry="50" fill="${fur}"/>
    <ellipse cx="100" cy="180" rx="30" ry="34" fill="${face}"/>
    <ellipse cx="76" cy="220" rx="18" ry="9" fill="${dark}"/><ellipse cx="124" cy="220" rx="18" ry="9" fill="${dark}"/>
    <circle cx="40" cy="88" r="22" fill="${fur}"/><circle cx="40" cy="88" r="12" fill="${face}"/>
    <circle cx="160" cy="88" r="22" fill="${fur}"/><circle cx="160" cy="88" r="12" fill="${face}"/>
    <circle cx="100" cy="84" r="58" fill="${fur}"/>
    <path d="M90 30 Q96 14 106 22 Q102 26 108 30 Z" fill="${dark}"/>
    <circle cx="80" cy="78" r="23" fill="${face}"/><circle cx="120" cy="78" r="23" fill="${face}"/>
    <ellipse cx="100" cy="106" rx="40" ry="28" fill="${face}"/>
    <circle cx="82" cy="80" r="8.5" fill="#2A1A0E"/><circle cx="85" cy="77" r="3" fill="#fff"/>
    <circle cx="118" cy="80" r="8.5" fill="#2A1A0E"/><circle cx="121" cy="77" r="3" fill="#fff"/>
    <ellipse cx="66" cy="104" rx="8" ry="5.5" fill="#F29C9C" opacity=".8"/><ellipse cx="134" cy="104" rx="8" ry="5.5" fill="#F29C9C" opacity=".8"/>
    <ellipse cx="95" cy="98" rx="3" ry="2.2" fill="#5C3818"/><ellipse cx="105" cy="98" rx="3" ry="2.2" fill="#5C3818"/>
    ${pose === "down"
      ? `<path d="M86 112 Q100 122 114 112" stroke="#3A2314" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M84 110 Q100 132 116 110 Z" fill="#C44A4A" stroke="#3A2314" stroke-width="3" stroke-linejoin="round"/>`}
    ${bandana}${phones}${armL}${armR}${banana}
  </svg>`;
}
