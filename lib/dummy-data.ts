import {
  IconFileText,
  IconBulb,
  IconListCheck,
  IconFeather,
  type Icon,
} from '@tabler/icons-react'

export interface SuggestionCard {
  icon: Icon
  title: string
  prompt: string
}

export const suggestionCards: SuggestionCard[] = [
  {
    icon: IconBulb,
    title: 'Brainstorm ide',
    prompt: 'Bantu saya brainstorm ide untuk ',
  },
  {
    icon: IconFeather,
    title: 'Bantu menulis',
    prompt: 'Tolong tuliskan draft untuk ',
  },
  {
    icon: IconListCheck,
    title: 'Buat rencana',
    prompt: 'Buatkan saya rencana untuk ',
  },
  {
    icon: IconFileText,
    title: 'Rangkum teks',
    prompt: 'Rangkum teks berikut: ',
  },
]
