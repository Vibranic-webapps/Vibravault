<script setup lang="ts">
/**
 * THE one form field - text, email, password, date, select and textarea all
 * share this component, so they can never look different from each other
 * again. Item #7 happened because the date and select fields were styled
 * separately from the text fields and got missed.
 *
 * Pressed IN (inset shadow) = "type here". Label always above, error or hint
 * always below. `prefix` puts a symbol like € inside the field.
 */
interface Option { value: string; label: string }
interface Props {
  modelValue: string
  label: string
  as?: 'input' | 'select' | 'textarea'
  type?: 'text' | 'email' | 'password' | 'date' | 'search'
  inputmode?: 'text' | 'decimal' | 'numeric' | 'email' | 'search'
  options?: Option[]
  placeholder?: string
  hint?: string
  error?: string | null
  prefix?: string
  size?: 'md' | 'lg'
  autocomplete?: string
  maxlength?: number
  required?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  as: 'input', type: 'text', size: 'md', options: () => [], error: null,
})
const emit = defineEmits<{ 'update:modelValue': [value: string]; enter: [] }>()

const id = useId()
const describedBy = computed(() =>
  props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined,
)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && props.as === 'input') emit('enter')
}
</script>

<template>
  <div class="field" :class="[size, { invalid: !!error }]">
    <label class="lbl" :for="id">{{ label }}</label>

    <div class="wrap">
      <span v-if="prefix" class="prefix" aria-hidden="true">{{ prefix }}</span>

      <select
        v-if="as === 'select'"
        :id="id"
        class="vv-field control"
        :value="modelValue"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
        :required="required"
        @change="onInput"
      >
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>

      <textarea
        v-else-if="as === 'textarea'"
        :id="id"
        class="vv-field control area"
        :value="modelValue"
        :placeholder="placeholder"
        :maxlength="maxlength"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
        rows="3"
        @input="onInput"
      />

      <input
        v-else
        :id="id"
        class="vv-field control"
        :class="{ 'has-prefix': !!prefix }"
        :type="type"
        :value="modelValue"
        :inputmode="inputmode"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :required="required"
        :aria-invalid="!!error || undefined"
        :aria-describedby="describedBy"
        @input="onInput"
        @keydown="onKey"
      >
    </div>

    <p v-if="error" :id="`${id}-error`" class="msg err" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="msg">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: 7px; }
.lbl { font-size: 13px; font-weight: 600; color: var(--vv-muted); }
.wrap { position: relative; }
.control { font-family: inherit; }
.area { resize: vertical; min-height: 88px; line-height: 1.45; }

.prefix {
  position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
  font-weight: 700; color: var(--vv-muted); pointer-events: none;
}
.has-prefix { padding-left: 38px; }

/* Large: the amount field, where the number IS the point of the screen. */
.lg .control { min-height: 64px; font-size: 28px; font-weight: 800; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
.lg .prefix { font-size: 22px; }
.lg .has-prefix { padding-left: 44px; }

.invalid .control { box-shadow: var(--vv-p2), 0 0 0 2px var(--vv-negative-ring); }
.msg { margin: 0; font-size: 12px; color: var(--vv-muted-2); }
.msg.err { color: var(--vv-negative); font-weight: 600; }
</style>
