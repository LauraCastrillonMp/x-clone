import React from 'react';
import AppNavigation from './src/navigation';

// ensure firebase config (and GoogleSignin.configure) runs before anything else
import './src/services/firebase';

export default function App() {
  return <AppNavigation />;
}