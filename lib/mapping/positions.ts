import type { Position } from "@/lib/types";

/** Project-level position overrides for players whose FPL role differs from Opta.
 *  Official FPL Midfielders list (screenshots) is the source of truth when Opta disagrees. */
const POSITION_OVERRIDES: Record<string, Position> = {
  // Matheus Nunes is a Defender in FPL, despite Opta listing him as a Midfielder.
  "3trkre1c81pzretsjsi8jk6sq": "DEF",

  // FPL Midfielders authority ∩ store FWD (Opta Forward → FPL MID)
  "v78uhwxgzojcec8lsdvucusp": "MID", // B. Mbeumo
  "7tnuxlg9l4rjhc7j3ko36hduy": "MID", // A. Semenyo
  "8tc7dcuwdeqbjgt7vw5p38xgq": "MID", // B. Saka
  "6psklvi66inwws7buzf16yjft": "MID", // Pedro Neto
  "5wengf05apke7rv3kms186j56": "MID", // A. Elanga
  "e5eiuko5p1yms97xndrvcr0bu": "MID", // A. Garnacho
  "6cx5c6bzp1hq6c1vui53mxzx0": "MID", // Abdul Fatawu
  "9kodabl8cpzeezsy6783se1as": "MID", // Allan
  "7x5very8ubtscmpfk4ghfpwyc": "MID", // Alysson
  "a71n80h977h7fu99ftnri5zsa": "MID", // B. Barcola
  "5fn9m086q3b5kdgt055bol638": "MID", // B. Gannon-Doak
  "1l228p52d8wdf8qhfxqu8rca": "MID", // B. Johnson
  "c2p36c1bs0hddw58lf48iy68k": "MID", // B. Touré
  "9psfk94nduz6icnuwty5v9all": "MID", // C. Gakpo
  "7y6f63pj7horkzhdzbge02rqh": "MID", // C. Hudson-Odoi
  "5606cqx2mlkrp81oe6uh6ghec": "MID", // C. Talbi
  "acffs01m2p3b4uemzjrp51d9m": "MID", // C. Tzolis
  "dkwkmrmpb7rq4e660efcu5hat": "MID", // D. James
  "4x7o9h6ea8ldt9sxgz87vwycp": "MID", // D. Maeda
  "7qgt7sht6py670pt6t4wjhqay": "MID", // D. McNeil
  "7k0r5crdh9blj3edt31zwy0dm": "MID", // E. Guessand
  "8ezfdv6lgv4gz8kogxvvn1rtg": "MID", // Estêvão
  "c6nl81c1q4unq5js94s6s942x": "MID", // F. Chiesa
  "dlpk0a4jgiswcm2r75uh1czpx": "MID", // H. Wilson
  "20eqyvyrgtafzssdh0zaehdsk": "MID", // I. Mbaye
  "3r9qvhedhr1o6zm6c5l4alkpg": "MID", // I. Osman
  "44s112hd02w1i2ucvai9jy7e1": "MID", // I. Sarr
  "8cmkqkrjme3wb0gegzn1e6xre": "MID", // J. Anthony
  "4lg41m643jf18dgax298bufpw": "MID", // J. Bahoya
  "eybpkhnd5ldeiau8niu1gg57u": "MID", // J. Clarke
  "85gmjxvy1g5aj1lcizegwuaui": "MID", // J. Doku
  "3ojnucluy7h8fgk2myyo0zx4a": "MID", // J. Gelhardt
  "5qgc6zjc38a5xjl35gs7h3vu1": "MID", // J. Kluivert
  "t9fp85x7cuopfnxat4h830q2": "MID", // J. Philogene
  "8bj0welrf2r362hzigb86704q": "MID", // Kevin
  "bsnrrlvlht03c86wvaok0uuj8": "MID", // L. Koumas
  "97nqu0mjr4ulkoiqn3y6nsmzu": "MID", // L. Tchaouna
  "5vznxxfbteooxk2dd2ws76xhw": "MID", // M. Cho
  "61psw0tgtithfb7knevi50xec": "MID", // M. Dowman
  "2igz499o21aihmkugktp3nyms": "MID", // M. Fofana
  "604osk9a3lxpfpkavuziqmn6x": "MID", // M. Rashford
  "cv1d56d42wujfuc4kt6bn53x0": "MID", // M. Tel
  "9rm3r46uzxlmuqnp0jo4danhm": "MID", // Matheus Cunha
  "drjbms71w0kt1pidq8q17h05w": "MID", // N. Angulo
  "e3il1t1s5lrn4g8t85fcm40oa": "MID", // N. Madueke
  "aqvs12aqh0uczvrdi9cn02v4k": "MID", // R. McAidoo
  "7jpzrq4bpes3uc1pkh56sc0oa": "MID", // R. Mundle
  "154gonr6x9vuraxmzd9zi5xck": "MID", // R. Ngumoha
  "db59xs6wi27mder57ocnlidjo": "MID", // Rayan
  "759tgxt9xusnioh2clkiau4us": "MID", // S. Lacey
  "6nwn2522yescgrx57wkcxjhwq": "MID", // Sávio
  "3qov7l9cw4fu5xwh0lmxmsc2c": "MID", // T. Dibling
  "72xq9zy27facbbowtwsuzw0lw": "MID", // Z. Gozo
  "9rc52qb9ok79fbfbesv2amuj8": "MID", // Z. Yohanna
};

export function mapOptaPosition(raw?: string): Position {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("goalkeeper") || value === "gkp" || value === "gk") return "GKP";
  if (value.includes("defender") || value === "def") return "DEF";
  if (value.includes("midfielder") || value === "mid") return "MID";
  if (value.includes("forward") || value.includes("striker") || value === "fwd") return "FWD";
  return "MID";
}

export function mapPlayerPosition(id: string | undefined, raw?: string): Position {
  return (id && POSITION_OVERRIDES[id]) || mapOptaPosition(raw);
}

export function displayName(player: {
  knownName?: string;
  matchName?: string;
  firstName?: string;
  lastName?: string;
  shortFirstName?: string;
  shortLastName?: string;
}): string {
  if (player.knownName) return player.knownName;
  if (player.matchName) return player.matchName;
  const first = player.shortFirstName || player.firstName || "";
  const last = player.shortLastName || player.lastName || "";
  return `${first} ${last}`.trim() || "Unknown";
}
