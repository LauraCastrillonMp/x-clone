import React from 'react'
import {
  House, MagnifyingGlass, BookmarkSimple, Bell, PencilSimpleLine, UserCircle,
  Users, UserPlus, Heart as HeartIcon
} from 'phosphor-react'

const MAP = {
  home: House,
  search: MagnifyingGlass,
  saved: BookmarkSimple,
  notifications: Bell,
  compose: PencilSimpleLine,
  profile: UserCircle,
  followers: Users,
  following: UserPlus,
  heart: HeartIcon
}

export default function Icon({ name, size = 22, color = 'currentColor', weight = 'regular', style }) {
  const Cmp = MAP[name] || MagnifyingGlass
  return <Cmp size={size} color={color} weight={weight} style={style} />
}