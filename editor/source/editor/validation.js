/**
 * Field types for the editor extension.
 */

import {
  MatchValidationRule,
  LengthValidationRule,
  PatternValidationRule,
  RangeValidationRule,
  RequiredValidationRule,
} from 'selective-edit'

export const defaultValidationRules = {
  'length': LengthValidationRule,
  'match': MatchValidationRule,
  'pattern': PatternValidationRule,
  'range': RangeValidationRule,
  'required': RequiredValidationRule,
}
