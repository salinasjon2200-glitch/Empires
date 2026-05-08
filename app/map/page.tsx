'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const MapInner = dynamic(() => import('./MapInner'), { ssr: false });

export default function MapPage() {
  return <MapInner />;
}
