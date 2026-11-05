"use client"

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form"
import { SelectField, type SelectFieldProps } from "./select-field"

/**
 * SelectField wired to react-hook-form. Use it inside a form instead of `register()`:
 *   <FormSelectField control={form.control} name="status" label="Status" options={…} />
 * The error message from the schema is shown automatically.
 * (TInput / TOutput match useForm<TInput, unknown, TOutput> for schemas that transform their values.)
 */
export function FormSelectField<TInput extends FieldValues, TOutput = TInput>({
  control,
  name,
  error,
  ...rest
}: Omit<SelectFieldProps, "value" | "onValueChange" | "name" | "onBlur"> & {
  control: Control<TInput, unknown, TOutput>
  name: Path<TInput>
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <SelectField
          {...rest}
          name={field.name}
          value={field.value == null ? "" : String(field.value)}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
          error={error ?? fieldState.error?.message}
        />
      )}
    />
  )
}
