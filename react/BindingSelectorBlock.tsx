import type { FC } from 'react'
import React, { useState, useEffect } from 'react'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'
import { useQuery, useMutation, useLazyQuery } from 'react-apollo'
import { OrderFormProvider, useOrderForm } from 'vtex.order-manager/OrderForm'

import BindingSelectorList from './components/BindingSelectorList'
import getSalesChannel from './graphql/getSalesChannel.gql'
import updateSalesChannelMutation from './graphql/updateSalesChannel.gql'
import alternateHrefsQuery from './graphql/alternateHrefs.gql'
import shouldUpdateSalesChannel from './graphql/isSalesChannelUpdate.gql'
import { createRedirectUrl, filterBindings, getMatchRoute } from './utils'
import Spinner from './components/Spinner'

const CSS_HANDLES = [
  'container',
  'relativeContainer',
  'button',
  'buttonTextClasses',
] as const

const BindingSelectorBlock: FC = () => {
  const [currentBinding, setCurrentBiding] = useState<FilteredBinding>(
    {} as FilteredBinding
  )

  const [open, setOpen] = useState<boolean>(false)
  const handles = useCssHandles(CSS_HANDLES)
  const {
    // @ts-expect-error routes not typed in useRuntime
    route: {
      pageContext: { id, type },
    },
    binding: runtimeBinding,
  } = useRuntime()

  const queryVariables = {
    id,
    type,
  }

  const [
    getAlternateHrefs,
    { data: hrefAltData },
  ] = useLazyQuery<QueryInternal>(alternateHrefsQuery, {
    variables: queryVariables,
  })

  const [bindingInfo, setBindingInfo] = useState<FilteredBinding[]>([])
  const {
    error: tenantError,
    data: tenantData,
    loading: loadingTenantInfo,
  } = useQuery<TenantInfoResponse>(getSalesChannel, {
    ssr: false,
  })

  const [updateSalesChannel] = useMutation<
    { updateSalesChannel: { orderFormId: string } },
    UpdateSalesChannelVariables
  >(updateSalesChannelMutation)

  const {
    error: orderFormError,
    loading: loadingOrderForm,
    orderForm,
  } = useOrderForm()

  const [loadingRedirect, setLoadingRedirect] = useState<boolean>(false)

  const { data: toogleSalesChannel } = useQuery<SalesChannelResponse>(
    shouldUpdateSalesChannel
  )

  useEffect(() => {
    if (tenantData) {
      const filteredBindings = filterBindings(tenantData.tenantInfo)

      setBindingInfo(filteredBindings)
    }
  }, [tenantData])

  useEffect(() => {
    if (runtimeBinding?.id) {
      const findBinding = bindingInfo.find(
        ({ id: bindingId }) => bindingId === runtimeBinding.id
      )

      if (findBinding) {
        setCurrentBiding(findBinding)
      }
    }
  }, [bindingInfo, runtimeBinding])

  useEffect(() => {
    const { canonicalBaseAddress } = currentBinding
    const { hostname, protocol } = window.location
    let path = ''

    // eslint-disable-next-line vtex/prefer-early-return
    if (hrefAltData) {
      const { routes = [] } = hrefAltData.internal

      path = getMatchRoute({ routes, currentBindingId: currentBinding.id })

      window.location.href = createRedirectUrl({
        canonicalBaseAddress,
        hostname,
        protocol,
        path,
      })
    }
  }, [hrefAltData, currentBinding])

  const handleClick = () => {
    setOpen(!open)
  }

  const handleSelection = async (
    selectedBinding: FilteredBinding
  ): Promise<void> => {
    setLoadingRedirect(true)
    setCurrentBiding(selectedBinding)
    setOpen(false)
    if (toogleSalesChannel?.isSalesChannelUpdate) {
      try {
        await updateSalesChannel({
          variables: {
            orderFormId: orderForm.id,
            salesChannel: selectedBinding.salesChannel,
            locale: selectedBinding.label,
          },
        })
      } catch (e) {
        // How to handle when there is an error updating sales channel?
        console.error(e)
      }
    }

    getAlternateHrefs()
  }

  const isLoading =
    loadingTenantInfo ||
    loadingOrderForm ||
    !currentBinding.id ||
    loadingRedirect

  const hasError = !!orderFormError || !!tenantError

  if (hasError) {
    console.error('Error loading Binding Selector', {
      orderFormError,
      tenantError,
    })
  }

  return hasError ? null : (
    <div
      className={`${handles.container} flex items-center justify-center w3 relative`}
    >
      <div
        className={`${handles.relativeContainer} relative flex justify-center`}
      >
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <button
              type="button"
              onClick={handleClick}
              className={`${handles.button} link pa3 bg-transparent bn flex items-center pointer c-on-base`}
            >
              <span className={`${handles.buttonTextClasses}`}>
                {currentBinding.label}
              </span>
            </button>
            <BindingSelectorList
              open={open}
              currentBinding={currentBinding}
              bindingInfo={bindingInfo}
              onSelectBinding={handleSelection}
            />
          </>
        )}
      </div>
    </div>
  )
}

const BindingSelectorBlockWrapper = () => {
  return (
    <OrderFormProvider>
      <BindingSelectorBlock />
    </OrderFormProvider>
  )
}

export default BindingSelectorBlockWrapper
