import React from 'react';
import { RoutinesView } from './RoutinesView';

interface Props {
  parentId: string;
}

export function ListsView({ parentId }: Props) {
  return <RoutinesView parentId={parentId} />;
}
