import React from 'react';
import { BlotterDoodle } from './BlotterDoodle';
import { CapsuleDoodle } from './CapsuleDoodle';
import { DropperDoodle } from './DropperDoodle';
import { GelDoodle } from './GelDoodle';
import { InjectionDoodle } from './InjectionDoodle';
import { PatchDoodle } from './PatchDoodle';
import { SprayDoodle } from './SprayDoodle';
import { TabletDoodle } from './TabletDoodle';

export type DosageForm =
  | 'capsule'
  | 'tablet'
  | 'injection'
  | 'gel'
  | 'patch'
  | 'blotter'
  | 'dropper'
  | 'spray';

export const DOSAGE_FORM_LABELS: Record<DosageForm, { en: string; zh: string }> = {
  capsule: { en: 'Capsule', zh: '胶囊' },
  tablet: { en: 'Tablet', zh: '片剂' },
  injection: { en: 'Injection', zh: '针剂' },
  gel: { en: 'Gel', zh: '凝胶' },
  patch: { en: 'Patch', zh: '贴片' },
  blotter: { en: 'Blotter', zh: '舌下纸片' },
  dropper: { en: 'Dropper', zh: '滴剂' },
  spray: { en: 'Spray', zh: '喷雾' },
};

export interface FormDoodleProps {
  form: DosageForm;
  size?: number;
  asleep?: boolean;
  className?: string;
}

export const FormDoodle: React.FC<FormDoodleProps> = ({
  form,
  size = 2.25,
  asleep = false,
  className = '',
}) => {
  switch (form) {
    case 'capsule':
      return <CapsuleDoodle size={size} asleep={asleep} className={className} />;
    case 'tablet':
      return <TabletDoodle size={size} asleep={asleep} className={className} />;
    case 'injection':
      return <InjectionDoodle size={size} asleep={asleep} className={className} />;
    case 'gel':
      return <GelDoodle size={size} asleep={asleep} className={className} />;
    case 'patch':
      return <PatchDoodle size={size} asleep={asleep} className={className} />;
    case 'blotter':
      return <BlotterDoodle size={size} asleep={asleep} className={className} />;
    case 'dropper':
      return <DropperDoodle size={size} asleep={asleep} className={className} />;
    case 'spray':
      return <SprayDoodle size={size} asleep={asleep} className={className} />;
    default:
      return <TabletDoodle size={size} asleep={asleep} className={className} />;
  }
};
