/** "1 contato", "2 contatos": Portuguese only treats exactly one as singular. */
export const countLabel = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;
