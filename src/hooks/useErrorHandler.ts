import { useState, useCallback } from 'react'
import { isApiError, getFieldError, getErrorMessage, ApiError, ErrorCodes } from '@/lib/apiError'

interface ErrorState {
  /** The full ApiError, or null if no error */
  error: ApiError | null
  /** Banner-level message (non-field errors) */
  bannerMessage: string | null
  /** requestId for unexpected errors */
  requestId: string | undefined
}

/** Maps error codes to the field they should be displayed under */
export const CODE_FIELD_MAP: Record<string, string> = {
  [ErrorCodes.WRONG_PASSWORD]:       'password',
  [ErrorCodes.INVALID_CREDENTIALS]:  'password',
  [ErrorCodes.USER_NOT_FOUND]:       'email',
  [ErrorCodes.EMAIL_TAKEN]:          'email',
  [ErrorCodes.CONFLICT]:             'email',
}

interface UseErrorHandlerReturn {
  error: ApiError | null
  bannerMessage: string | null
  requestId: string | undefined
  /** Returns the field-level error for a specific field name */
  fieldError: (field: string) => string | undefined
  /** Call this in your catch block */
  handleError: (err: unknown) => void
  /** Clear all error state */
  clearError: () => void
  /** Clear a specific field error. Also clears the entire error if it was code-routed to that field. */
  clearFieldError: (field: string) => void
}

const EMPTY: ErrorState = { error: null, bannerMessage: null, requestId: undefined }

/** Determines whether an error should show as a banner vs field-level only */
function toBannerMessage(err: ApiError): string | null {
  const fieldOnlyCodes = new Set([
    ErrorCodes.WRONG_PASSWORD,
    ErrorCodes.INVALID_CREDENTIALS,
    ErrorCodes.USER_NOT_FOUND,
    ErrorCodes.EMAIL_TAKEN,
    ErrorCodes.CONFLICT,
    ErrorCodes.VALIDATION_ERROR,
  ])
  // If the error has field-level errors and no banner-worthy code, suppress banner
  if (fieldOnlyCodes.has(err.code as any) && err.fields && Object.keys(err.fields).length > 0) {
    return null
  }
  // Field-only codes with no fields still show as banner
  if (fieldOnlyCodes.has(err.code as any) && !err.fields) {
    return err.message
  }
  return err.message
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [state, setState] = useState<ErrorState>(EMPTY)

  const handleError = useCallback((err: unknown) => {
    if (!isApiError(err)) {
      // Non-API error — extract the best message we can
      const message = getErrorMessage(err)
      const wrapped = new ApiError('INTERNAL_SERVER_ERROR', message, 500)
      setState({
        error: wrapped,
        bannerMessage: message,
        requestId: undefined,
      })
      return
    }
    setState({
      error: err,
      bannerMessage: toBannerMessage(err),
      requestId: err.requestId,
    })
  }, [])

  const clearError = useCallback(() => setState(EMPTY), [])

  const clearFieldError = useCallback((field: string) => {
    setState((prev) => {
      if (!prev.error) return prev

      // If the error code itself routes to this field, clear everything
      if (CODE_FIELD_MAP[prev.error.code] === field) return EMPTY

      // Otherwise just remove the specific field from fields map
      if (!prev.error.fields?.[field]) return prev
      const newFields = { ...prev.error.fields }
      delete newFields[field]
      const hasRemainingFields = Object.keys(newFields).length > 0
      const newError = new ApiError(
        prev.error.code,
        prev.error.message,
        prev.error.statusCode,
        hasRemainingFields ? newFields : undefined,
        prev.error.requestId,
      )
      // If no fields remain and it was a VALIDATION_ERROR, clear everything
      if (!hasRemainingFields && prev.error.code === ErrorCodes.VALIDATION_ERROR) return EMPTY
      return {
        error: newError,
        bannerMessage: prev.bannerMessage,
        requestId: prev.requestId,
      }
    })
  }, [])

  const fieldError = useCallback(
    (field: string) => getFieldError(state.error, field),
    [state.error],
  )

  return {
    error:         state.error,
    bannerMessage: state.bannerMessage,
    requestId:     state.requestId,
    fieldError,
    handleError,
    clearError,
    clearFieldError,
  }
}
