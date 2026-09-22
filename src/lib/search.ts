export interface SearchEntry {
  type: 'research' | 'thought' | 'project' | 'page';
  title: string;
  url: string;
  external?: boolean;
  meta: string;
  blurb: string;
  tags: string[];
}