import type { ShareText } from "./share-card";

// Words for sharing and trip rooms, in both languages.

export type TogetherText = {
  kicker: string;
  title: string;
  intro: string;
  shareTitle: string;
  shareBody: string;
  shareButton: string;
  saveButton: string;
  making: string;
  share: ShareText;
  shareMessage: string;
  roomTitle: string;
  roomIntro: string;
  yourName: string;
  yourNamePlaceholder: string;
  roomName: string;
  roomNamePlaceholder: string;
  create: string;
  creating: string;
  orJoin: string;
  codePlaceholder: string;
  join: string;
  joining: string;
  joinTitle: (room: string) => string;
  joinIntro: string;
  invite: string;
  inviteHint: string;
  copyLink: string;
  copied: string;
  whatsapp: string;
  inviteMessage: (room: string, url: string) => string;
  race: string;
  you: string;
  places: (n: number) => string;
  paintings: (n: number) => string;
  moments: string;
  momentPlaceholder: string;
  momentCity: string;
  momentAny: string;
  post: string;
  posting: string;
  feed: {
    join: (name: string) => string;
    pack: (name: string, city: string) => string;
    complete: (name: string, city: string) => string;
  };
  empty: string;
  leave: string;
  open: string;
  notFound: string;
  errors: Record<string, string>;
  ago: (minutes: number) => string;
  backToPacks: string;
};

export const TOGETHER: Record<"en" | "sq", TogetherText> = {
  en: {
    kicker: "Share and travel together",
    title: "Your trip, with your people",
    intro: "Share a picture of your trip, or start a trip room: friends join with a link or QR, and you race to paint Kosovo together.",
    shareTitle: "Your trip card",
    shareBody: "Your seven paintings, how far you've got, and a QR that brings friends straight in. Sized for stories.",
    shareButton: "Share my trip",
    saveButton: "Save image",
    making: "Making your card…",
    share: {
      title: (name) => `${name}'s Kosovo`,
      untitled: "My Kosovo",
      stats: (packs, places, paintings) => `${packs} packs · ${places} places · ${paintings} paintings`,
      scan: "Scan to travel with me",
      roomLine: (room) => `Join “${room}”`,
    },
    shareMessage: "My Kosovo trip on 383",
    roomTitle: "Trip room",
    roomIntro: "A private room for your group. Everyone sees who has painted the most, and what each person just finished.",
    yourName: "Your name",
    yourNamePlaceholder: "e.g. Ana",
    roomName: "Room name",
    roomNamePlaceholder: "e.g. Summer in Kosovo",
    create: "Start a trip room",
    creating: "Starting…",
    orJoin: "Have a code?",
    codePlaceholder: "6-letter code",
    join: "Join",
    joining: "Joining…",
    joinTitle: (room) => `Join “${room}”`,
    joinIntro: "Pick a name your friends will recognise. Only your progress is shared: packs opened, places stamped, paintings finished. Never your location.",
    invite: "Invite friends",
    inviteHint: "Scan, or send the link",
    copyLink: "Copy link",
    copied: "Copied",
    whatsapp: "WhatsApp",
    inviteMessage: (room, url) => `Travel Kosovo with me: join “${room}” on 383 ${url}`,
    race: "The race",
    you: "you",
    places: (n) => `${n} ${n === 1 ? "place" : "places"}`,
    paintings: (n) => `${n} ★`,
    moments: "Moments",
    momentPlaceholder: "What just happened? (140 characters)",
    momentCity: "Where",
    momentAny: "Anywhere",
    post: "Post",
    posting: "Posting…",
    feed: {
      join: (name) => `${name} joined the trip`,
      pack: (name, city) => `${name} opened the ${city} pack`,
      complete: (name, city) => `${name} finished the ${city} painting ★`,
    },
    empty: "Nothing yet. Open a pack or post a moment.",
    leave: "Leave room",
    open: "Open room",
    notFound: "This room doesn't exist any more.",
    errors: {
      name_required: "Add your name first.",
      room_full: "This room is full (12 people).",
      rate_limited: "Too many tries. Wait a little and try again.",
      unavailable: "Trip rooms are offline right now.",
      not_found: "No room with that code.",
      failed: "That didn't work. Try again.",
    },
    ago: (m) => (m < 1 ? "now" : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`),
    backToPacks: "Open your packs",
  },
  sq: {
    kicker: "Ndaje dhe udhëto bashkë",
    title: "Udhëtimi yt, me njerëzit e tu",
    intro: "Ndaj një pamje të udhëtimit, ose hap një dhomë udhëtimi: shokët hyjnë me link ose QR dhe garoni kush e pikturon Kosovën i pari.",
    shareTitle: "Karta e udhëtimit",
    shareBody: "Shtatë pikturat e tua, sa ke arritur dhe një QR që i sjell shokët drejt e brenda. Në madhësi për story.",
    shareButton: "Ndaj udhëtimin",
    saveButton: "Ruaj foton",
    making: "Po e bëjmë kartën…",
    share: {
      title: (name) => `Kosova e ${name}`,
      untitled: "Kosova ime",
      stats: (packs, places, paintings) => `${packs} paketa · ${places} vende · ${paintings} piktura`,
      scan: "Skano dhe udhëto me mua",
      roomLine: (room) => `Hyr te “${room}”`,
    },
    shareMessage: "Udhëtimi im në Kosovë me 383",
    roomTitle: "Dhoma e udhëtimit",
    roomIntro: "Një dhomë private për grupin tënd. Të gjithë shohin kush ka pikturuar më shumë dhe çka sapo e përfundoi secili.",
    yourName: "Emri yt",
    yourNamePlaceholder: "p.sh. Ana",
    roomName: "Emri i dhomës",
    roomNamePlaceholder: "p.sh. Vera në Kosovë",
    create: "Hap një dhomë udhëtimi",
    creating: "Po hapet…",
    orJoin: "Ke një kod?",
    codePlaceholder: "Kodi me 6 shkronja",
    join: "Hyr",
    joining: "Po hyn…",
    joinTitle: (room) => `Hyr te “${room}”`,
    joinIntro: "Zgjidh një emër që e njohin shokët. Ndahet vetëm përparimi yt: paketat e hapura, vendet e vulosura, pikturat e përfunduara. Kurrë vendndodhja.",
    invite: "Fto shokët",
    inviteHint: "Skano, ose dërgo linkun",
    copyLink: "Kopjo linkun",
    copied: "U kopjua",
    whatsapp: "WhatsApp",
    inviteMessage: (room, url) => `Udhëto Kosovën me mua: hyr te “${room}” në 383 ${url}`,
    race: "Gara",
    you: "ti",
    places: (n) => `${n} ${n === 1 ? "vend" : "vende"}`,
    paintings: (n) => `${n} ★`,
    moments: "Momentet",
    momentPlaceholder: "Çka sapo ndodhi? (140 shenja)",
    momentCity: "Ku",
    momentAny: "Kudo",
    post: "Posto",
    posting: "Po postohet…",
    feed: {
      join: (name) => `${name} u bashkua në udhëtim`,
      pack: (name, city) => `${name} hapi paketën e qytetit ${city}`,
      complete: (name, city) => `${name} përfundoi pikturën e qytetit ${city} ★`,
    },
    empty: "Ende asgjë. Hap një paketë ose posto një moment.",
    leave: "Dil nga dhoma",
    open: "Hap dhomën",
    notFound: "Kjo dhomë nuk ekziston më.",
    errors: {
      name_required: "Shto emrin tënd së pari.",
      room_full: "Dhoma është plot (12 veta).",
      rate_limited: "Shumë provime. Prit pak dhe provo sërish.",
      unavailable: "Dhomat e udhëtimit nuk janë në linjë tani.",
      not_found: "Nuk ka dhomë me atë kod.",
      failed: "Nuk funksionoi. Provo sërish.",
    },
    ago: (m) => (m < 1 ? "tani" : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} orë` : `${Math.floor(m / 1440)} ditë`),
    backToPacks: "Hap paketat e tua",
  },
};
