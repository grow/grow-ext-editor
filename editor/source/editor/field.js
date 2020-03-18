/**
 * Field types for the editor extension.
 */

import {
  GroupField,
  ListField,
} from 'selective-edit'
import {
  DocumentField,
  YamlField,
} from './field/constructor'
import {
  ImageFileField,
  GoogleImageField,
} from './field/image'
import {
  PartialsField,
} from './field/partials'
import {
  CheckboxField,
  DateField,
  DateTimeField,
  MarkdownField,
  SelectField,
  TextField,
  TextareaField,
} from './field/standard'

export const defaultFields = {
  'checkbox': CheckboxField,
  'date': DateField,
  'datetime': DateTimeField,
  'document': DocumentField,
  'google_image': GoogleImageField,
  'group': GroupField,
  'image': ImageFileField,
  'list': ListField,
  'markdown': MarkdownField,
  'partials': PartialsField,
  'select': SelectField,
  'text': TextField,
  'textarea': TextareaField,
  'yaml': YamlField,
}
