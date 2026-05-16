export type Role = 'guest' | 'participant' | 'editor' | 'moderator' | 'admin'
export type EditStatus = 'pending' | 'approved' | 'rejected'
export type RelationType = 'parent' | 'child' | 'spouse' | 'sibling' | 'adopted'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  phone: string
  role: Role
  approved: boolean
  created_at: string
  approved_by: string | null
  approved_at: string | null
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  patronymic: string | null
  birth_date: string | null
  death_date: string | null
  birth_place: string | null
  biography: string | null
  burial_place: string | null
  burial_lat: number | null
  burial_lng: number | null
  is_published: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Relationship {
  id: string
  person1_id: string
  person2_id: string
  relation_type: RelationType
  created_by: string
  created_at: string
}

export interface Photo {
  id: string
  person_id: string
  storage_path: string
  caption: string | null
  taken_year: number | null
  taken_place: string | null
  is_primary: boolean
  is_approved: boolean
  uploaded_by: string
  created_at: string
}

export interface Edit {
  id: string
  person_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  proposed_by: string
  status: EditStatus
  votes_for: number
  votes_against: number
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

export interface Vote {
  id: string
  edit_id: string
  user_id: string
  vote: boolean
  created_at: string
}
