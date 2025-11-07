import React from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Orbyt</div>
      <nav className="sidenav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="home" weight="bold" /><span>Home</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="search" weight="bold" /><span>Search</span>
        </NavLink>
        {/* <NavLink to="/saved" className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="saved" weight="bold" /><span>Saved</span>
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="notifications" weight="bold" /><span>Notifications</span>
        </NavLink> */}
        <NavLink to="/compose" className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="compose" weight="bold" /><span>Compose</span>
        </NavLink>
        {/* Removed Followers/Following from sidebar; access from profile screens */}
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          <Icon name="profile" weight="bold" /><span>My Profile</span>
        </NavLink>
      </nav>
    </aside>
  )
}