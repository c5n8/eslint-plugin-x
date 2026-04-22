/** @type { import("cspell").CSpellUserSettings } */
export default {
  version: '0.2',
  language: 'en',
  ignorePaths: ['pnpm-lock.yaml'],
  useGitignore: true,
  dictionaries: ['words'],

  dictionaryDefinitions: [
    {
      name: 'words',
      path: './words.txt',
      addWords: true,
    },
  ],
}
