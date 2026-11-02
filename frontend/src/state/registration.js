import { reactive } from 'vue'

export const registrationDraft = reactive({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  birthDate: '',
  gender: '',
  chronotype: '',
})

export function hasRegistrationDetails() {
  return Boolean(registrationDraft.firstName && registrationDraft.lastName && registrationDraft.email && registrationDraft.password)
}

export function clearRegistrationDraft() {
  Object.assign(registrationDraft, {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    birthDate: '',
    gender: '',
    chronotype: '',
  })
}
