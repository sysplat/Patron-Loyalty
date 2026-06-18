export interface LegalSection {
  id: string;
  title: string;
  body: string;
}

export interface LegalDocumentContent {
  intro: string;
  sections: LegalSection[];
}
