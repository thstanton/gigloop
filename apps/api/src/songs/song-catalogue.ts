export interface CatalogueEntry {
  id: string;
  title: string;
  artist?: string;
  genre: string;
}

export interface CatalogueGroup {
  genre: string;
  label: string;
  songs: CatalogueEntry[];
}

const CATALOGUE: CatalogueEntry[] = [
  // Contemporary
  { id: 'con-001', title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: 'con-002', title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: 'con-003', title: 'All of Me', artist: 'John Legend', genre: 'CONTEMPORARY' },
  { id: 'con-004', title: 'A Thousand Years', artist: 'Christina Perri', genre: 'CONTEMPORARY' },
  { id: 'con-005', title: 'Can\'t Help Falling in Love', artist: 'Elvis Presley', genre: 'CONTEMPORARY' },
  { id: 'con-006', title: 'Make You Feel My Love', artist: 'Adele', genre: 'CONTEMPORARY' },
  { id: 'con-007', title: 'Someone Like You', artist: 'Adele', genre: 'CONTEMPORARY' },
  { id: 'con-008', title: 'Marry Me', artist: 'Train', genre: 'CONTEMPORARY' },
  { id: 'con-009', title: 'Better Together', artist: 'Jack Johnson', genre: 'CONTEMPORARY' },
  { id: 'con-010', title: 'Hallelujah', artist: 'Leonard Cohen', genre: 'CONTEMPORARY' },
  { id: 'con-011', title: 'The Book of Love', artist: 'Peter Gabriel', genre: 'CONTEMPORARY' },
  { id: 'con-012', title: 'At Last', artist: 'Etta James', genre: 'CONTEMPORARY' },
  { id: 'con-013', title: 'Lover', artist: 'Taylor Swift', genre: 'CONTEMPORARY' },
  { id: 'con-014', title: 'Golden Hour', artist: 'JVKE', genre: 'CONTEMPORARY' },
  { id: 'con-015', title: 'Die With A Smile', artist: 'Lady Gaga & Bruno Mars', genre: 'CONTEMPORARY' },

  // Classical
  { id: 'cla-001', title: 'Canon in D', artist: 'Pachelbel', genre: 'CLASSICAL' },
  { id: 'cla-002', title: 'Air on the G String', artist: 'Bach', genre: 'CLASSICAL' },
  { id: 'cla-003', title: 'Clair de Lune', artist: 'Debussy', genre: 'CLASSICAL' },
  { id: 'cla-004', title: 'Jesu, Joy of Man\'s Desiring', artist: 'Bach', genre: 'CLASSICAL' },
  { id: 'cla-005', title: 'Ave Maria', artist: 'Schubert', genre: 'CLASSICAL' },
  { id: 'cla-006', title: 'Ave Maria', artist: 'Bach / Gounod', genre: 'CLASSICAL' },
  { id: 'cla-007', title: 'Trumpet Voluntary', artist: 'Clarke', genre: 'CLASSICAL' },
  { id: 'cla-008', title: 'Wedding March', artist: 'Mendelssohn', genre: 'CLASSICAL' },
  { id: 'cla-009', title: 'Bridal Chorus', artist: 'Wagner', genre: 'CLASSICAL' },
  { id: 'cla-010', title: 'Moonlight Sonata', artist: 'Beethoven', genre: 'CLASSICAL' },
  { id: 'cla-011', title: 'Gymnopédie No. 1', artist: 'Satie', genre: 'CLASSICAL' },
  { id: 'cla-012', title: 'Spring (Four Seasons)', artist: 'Vivaldi', genre: 'CLASSICAL' },
  { id: 'cla-013', title: 'Adagio in G Minor', artist: 'Albinoni', genre: 'CLASSICAL' },

  // Jazz
  { id: 'jaz-001', title: 'La Vie en Rose', artist: 'Édith Piaf', genre: 'JAZZ' },
  { id: 'jaz-002', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'JAZZ' },
  { id: 'jaz-003', title: 'The Way You Look Tonight', artist: 'Frank Sinatra', genre: 'JAZZ' },
  { id: 'jaz-004', title: 'Cheek to Cheek', artist: 'Fred Astaire', genre: 'JAZZ' },
  { id: 'jaz-005', title: 'L-O-V-E', artist: 'Nat King Cole', genre: 'JAZZ' },
  { id: 'jaz-006', title: 'Isn\'t She Lovely', artist: 'Stevie Wonder', genre: 'JAZZ' },
  { id: 'jaz-007', title: 'What a Wonderful World', artist: 'Louis Armstrong', genre: 'JAZZ' },
  { id: 'jaz-008', title: 'Unforgettable', artist: 'Nat King Cole', genre: 'JAZZ' },
  { id: 'jaz-009', title: 'Come Fly With Me', artist: 'Frank Sinatra', genre: 'JAZZ' },
  { id: 'jaz-010', title: 'Autumn Leaves', genre: 'JAZZ' },
  { id: 'jaz-011', title: 'Misty', artist: 'Erroll Garner', genre: 'JAZZ' },
  { id: 'jaz-012', title: 'Blue Moon', genre: 'JAZZ' },
  { id: 'jaz-013', title: 'Moon River', artist: 'Henry Mancini', genre: 'JAZZ' },

  // Film / TV / Musicals
  { id: 'ftv-001', title: 'Somewhere Over the Rainbow', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-002', title: 'My Heart Will Go On', artist: 'Céline Dion', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-003', title: 'Can You Feel the Love Tonight', artist: 'Elton John', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-004', title: 'A Whole New World', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-005', title: 'Beauty and the Beast', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-006', title: 'Edelweiss', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-007', title: 'The Sound of Music', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-008', title: 'Marry Me (Dum Dum)', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-009', title: 'Cinema Paradiso Theme', artist: 'Ennio Morricone', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-010', title: 'Game of Thrones Theme', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-011', title: 'Shallow', artist: 'Lady Gaga & Bradley Cooper', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-012', title: 'City of Stars', genre: 'FILM_TV_MUSICALS' },
  { id: 'ftv-013', title: 'Rewrite the Stars', genre: 'FILM_TV_MUSICALS' },

  // Bollywood
  { id: 'bol-001', title: 'Tum Hi Ho', artist: 'Arijit Singh', genre: 'BOLLYWOOD' },
  { id: 'bol-002', title: 'Kal Ho Naa Ho', genre: 'BOLLYWOOD' },
  { id: 'bol-003', title: 'Mere Haath Mein', genre: 'BOLLYWOOD' },
  { id: 'bol-004', title: 'Dil Se Re', genre: 'BOLLYWOOD' },
  { id: 'bol-005', title: 'Kabhi Khushi Kabhie Gham', genre: 'BOLLYWOOD' },
  { id: 'bol-006', title: 'Tujh Mein Rab Dikhta Hai', genre: 'BOLLYWOOD' },
  { id: 'bol-007', title: 'Ae Dil Hai Mushkil', artist: 'Arijit Singh', genre: 'BOLLYWOOD' },
  { id: 'bol-008', title: 'Raabta', genre: 'BOLLYWOOD' },
  { id: 'bol-009', title: 'Gerua', genre: 'BOLLYWOOD' },
  { id: 'bol-010', title: 'Phir Le Aya Dil', genre: 'BOLLYWOOD' },

  // Christmas
  { id: 'xms-001', title: 'White Christmas', artist: 'Bing Crosby', genre: 'CHRISTMAS' },
  { id: 'xms-002', title: 'Have Yourself a Merry Little Christmas', genre: 'CHRISTMAS' },
  { id: 'xms-003', title: 'The Christmas Song', artist: 'Nat King Cole', genre: 'CHRISTMAS' },
  { id: 'xms-004', title: 'Winter Wonderland', genre: 'CHRISTMAS' },
  { id: 'xms-005', title: 'Jingle Bell Rock', genre: 'CHRISTMAS' },
  { id: 'xms-006', title: 'Rudolph the Red-Nosed Reindeer', genre: 'CHRISTMAS' },
  { id: 'xms-007', title: 'O Holy Night', genre: 'CHRISTMAS' },
  { id: 'xms-008', title: 'Silent Night', genre: 'CHRISTMAS' },
  { id: 'xms-009', title: 'All I Want for Christmas Is You', artist: 'Mariah Carey', genre: 'CHRISTMAS' },
  { id: 'xms-010', title: 'Last Christmas', artist: 'Wham!', genre: 'CHRISTMAS' },
  { id: 'xms-011', title: 'Fairytale of New York', artist: 'The Pogues', genre: 'CHRISTMAS' },
  { id: 'xms-012', title: 'It\'s Beginning to Look a Lot Like Christmas', genre: 'CHRISTMAS' },
];

const GENRE_LABELS: Record<string, string> = {
  CONTEMPORARY: 'Contemporary',
  CLASSICAL: 'Classical',
  JAZZ: 'Jazz',
  FILM_TV_MUSICALS: 'Film / TV / Musicals',
  BOLLYWOOD: 'Bollywood',
  CHRISTMAS: 'Christmas',
};

export function getCatalogue(): CatalogueGroup[] {
  const groups: CatalogueGroup[] = [];
  for (const genre of Object.keys(GENRE_LABELS)) {
    groups.push({
      genre,
      label: GENRE_LABELS[genre],
      songs: CATALOGUE.filter((s) => s.genre === genre),
    });
  }
  return groups;
}

export function getCatalogueById(id: string): CatalogueEntry | undefined {
  return CATALOGUE.find((s) => s.id === id);
}

export function getCatalogueEntries(ids: string[]): CatalogueEntry[] {
  const idSet = new Set(ids);
  return CATALOGUE.filter((s) => idSet.has(s.id));
}
