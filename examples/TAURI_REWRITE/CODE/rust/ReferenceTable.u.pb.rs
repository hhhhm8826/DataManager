const _: () = ::protobuf::__internal::assert_compatible_gencode_version("4.34.1-release");
// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__MiddleTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct MiddleTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<MiddleTarget>
}

impl ::protobuf::Message for MiddleTarget {}

impl ::std::default::Default for MiddleTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for MiddleTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `MiddleTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `MiddleTargetMut`.
unsafe impl Sync for MiddleTarget {}

// SAFETY:
// - `MiddleTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for MiddleTarget {}

impl ::protobuf::Proxied for MiddleTarget {
  type View<'msg> = MiddleTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for MiddleTarget {}

impl ::protobuf::MutProxied for MiddleTarget {
  type Mut<'msg> = MiddleTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct MiddleTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, MiddleTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for MiddleTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for MiddleTargetView<'msg> {
  type Message = MiddleTarget;
}

impl ::std::fmt::Debug for MiddleTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for MiddleTargetView<'_> {
  fn default() -> MiddleTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, MiddleTarget>> for MiddleTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, MiddleTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> MiddleTargetView<'msg> {

  pub fn to_owned(&self) -> MiddleTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn single_opt(self) -> ::protobuf::Optional<super::SingleTargetView<'msg>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(self) -> super::SingleTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }

}

// SAFETY:
// - `MiddleTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for MiddleTargetView<'_> {}

// SAFETY:
// - `MiddleTargetView` is `Send` because while its alive a `MiddleTargetMut` cannot.
// - `MiddleTargetView` does not use thread-local data.
unsafe impl Send for MiddleTargetView<'_> {}

impl<'msg> ::protobuf::AsView for MiddleTargetView<'msg> {
  type Proxied = MiddleTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, MiddleTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for MiddleTargetView<'msg> {
  fn into_view<'shorter>(self) -> MiddleTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<MiddleTarget> for MiddleTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> MiddleTarget {
    let mut dst = MiddleTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<MiddleTarget> for MiddleTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> MiddleTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for MiddleTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for MiddleTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for MiddleTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct MiddleTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, MiddleTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for MiddleTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for MiddleTargetMut<'msg> {
  type Message = MiddleTarget;
}

impl ::std::fmt::Debug for MiddleTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, MiddleTarget>> for MiddleTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, MiddleTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> MiddleTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, MiddleTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> MiddleTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_single(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn single_opt(&self) -> ::protobuf::Optional<super::SingleTargetView<'_>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(&self) -> super::SingleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }
  pub fn single_mut(&mut self) -> super::SingleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_single(&mut self,
    val: impl ::protobuf::IntoProxied<super::SingleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}

// SAFETY:
// - `MiddleTargetMut` does not perform any shared mutation.
unsafe impl Send for MiddleTargetMut<'_> {}

// SAFETY:
// - `MiddleTargetMut` does not perform any shared mutation.
unsafe impl Sync for MiddleTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for MiddleTargetMut<'msg> {
  type Proxied = MiddleTarget;
  fn as_view(&self) -> ::protobuf::View<'_, MiddleTarget> {
    MiddleTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for MiddleTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, MiddleTarget>
  where
      'msg: 'shorter {
    MiddleTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for MiddleTargetMut<'msg> {
  type MutProxied = MiddleTarget;
  fn as_mut(&mut self) -> MiddleTargetMut<'msg> {
    MiddleTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for MiddleTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> MiddleTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl MiddleTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, MiddleTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> MiddleTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> MiddleTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_single(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn single_opt(&self) -> ::protobuf::Optional<super::SingleTargetView<'_>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(&self) -> super::SingleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }
  pub fn single_mut(&mut self) -> super::SingleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_single(&mut self,
    val: impl ::protobuf::IntoProxied<super::SingleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}  // impl MiddleTarget

impl ::std::ops::Drop for MiddleTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for MiddleTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for MiddleTarget {
  type Proxied = Self;
  fn as_view(&self) -> MiddleTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for MiddleTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> MiddleTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for MiddleTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__MiddleTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P3");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__MiddleTarget_msg_init.0, &[<super::SingleTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            ], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__MiddleTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for MiddleTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for MiddleTarget {
  type Msg = MiddleTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<MiddleTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for MiddleTarget {
  type Msg = MiddleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<MiddleTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for MiddleTargetMut<'_> {
  type Msg = MiddleTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<MiddleTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for MiddleTargetMut<'_> {
  type Msg = MiddleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<MiddleTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for MiddleTargetView<'_> {
  type Msg = MiddleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<MiddleTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for MiddleTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__RootTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct RootTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<RootTarget>
}

impl ::protobuf::Message for RootTarget {}

impl ::std::default::Default for RootTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for RootTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `RootTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `RootTargetMut`.
unsafe impl Sync for RootTarget {}

// SAFETY:
// - `RootTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for RootTarget {}

impl ::protobuf::Proxied for RootTarget {
  type View<'msg> = RootTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for RootTarget {}

impl ::protobuf::MutProxied for RootTarget {
  type Mut<'msg> = RootTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct RootTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, RootTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for RootTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for RootTargetView<'msg> {
  type Message = RootTarget;
}

impl ::std::fmt::Debug for RootTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for RootTargetView<'_> {
  fn default() -> RootTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, RootTarget>> for RootTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, RootTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> RootTargetView<'msg> {

  pub fn to_owned(&self) -> RootTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn single_opt(self) -> ::protobuf::Optional<super::SingleTargetView<'msg>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(self) -> super::SingleTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }

  // composite: optional message DATA_MANAGER_FIXTURE.CompositeTarget
  pub fn has_composite(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(2)
    }
  }
  pub fn composite_opt(self) -> ::protobuf::Optional<super::CompositeTargetView<'msg>> {
        ::protobuf::Optional::new(self.composite(), self.has_composite())
  }
  pub fn composite(self) -> super::CompositeTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(2)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CompositeTargetView::default())
  }

  // group: optional message DATA_MANAGER_FIXTURE.GroupTarget
  pub fn has_group(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(3)
    }
  }
  pub fn group_opt(self) -> ::protobuf::Optional<super::GroupTargetView<'msg>> {
        ::protobuf::Optional::new(self.group(), self.has_group())
  }
  pub fn group(self) -> super::GroupTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(3)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::GroupTargetView::default())
  }

  // middle: optional message DATA_MANAGER_FIXTURE.MiddleTarget
  pub fn has_middle(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(4)
    }
  }
  pub fn middle_opt(self) -> ::protobuf::Optional<super::MiddleTargetView<'msg>> {
        ::protobuf::Optional::new(self.middle(), self.has_middle())
  }
  pub fn middle(self) -> super::MiddleTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(4)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::MiddleTargetView::default())
  }

  // noKey: optional message DATA_MANAGER_FIXTURE.NoKeyTarget
  pub fn has_noKey(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(5)
    }
  }
  pub fn noKey_opt(self) -> ::protobuf::Optional<super::NoKeyTargetView<'msg>> {
        ::protobuf::Optional::new(self.noKey(), self.has_noKey())
  }
  pub fn noKey(self) -> super::NoKeyTargetView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(5)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::NoKeyTargetView::default())
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        6, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }

}

// SAFETY:
// - `RootTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for RootTargetView<'_> {}

// SAFETY:
// - `RootTargetView` is `Send` because while its alive a `RootTargetMut` cannot.
// - `RootTargetView` does not use thread-local data.
unsafe impl Send for RootTargetView<'_> {}

impl<'msg> ::protobuf::AsView for RootTargetView<'msg> {
  type Proxied = RootTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, RootTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for RootTargetView<'msg> {
  fn into_view<'shorter>(self) -> RootTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<RootTarget> for RootTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> RootTarget {
    let mut dst = RootTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<RootTarget> for RootTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> RootTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for RootTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for RootTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for RootTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct RootTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, RootTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for RootTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for RootTargetMut<'msg> {
  type Message = RootTarget;
}

impl ::std::fmt::Debug for RootTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, RootTarget>> for RootTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, RootTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> RootTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, RootTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> RootTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_single(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn single_opt(&self) -> ::protobuf::Optional<super::SingleTargetView<'_>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(&self) -> super::SingleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }
  pub fn single_mut(&mut self) -> super::SingleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_single(&mut self,
    val: impl ::protobuf::IntoProxied<super::SingleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

  // composite: optional message DATA_MANAGER_FIXTURE.CompositeTarget
  pub fn has_composite(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(2)
    }
  }
  pub fn clear_composite(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        2
      );
    }
  }
  pub fn composite_opt(&self) -> ::protobuf::Optional<super::CompositeTargetView<'_>> {
        ::protobuf::Optional::new(self.composite(), self.has_composite())
  }
  pub fn composite(&self) -> super::CompositeTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(2)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CompositeTargetView::default())
  }
  pub fn composite_mut(&mut self) -> super::CompositeTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         2, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_composite(&mut self,
    val: impl ::protobuf::IntoProxied<super::CompositeTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        val
      );
    }
  }

  // group: optional message DATA_MANAGER_FIXTURE.GroupTarget
  pub fn has_group(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(3)
    }
  }
  pub fn clear_group(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        3
      );
    }
  }
  pub fn group_opt(&self) -> ::protobuf::Optional<super::GroupTargetView<'_>> {
        ::protobuf::Optional::new(self.group(), self.has_group())
  }
  pub fn group(&self) -> super::GroupTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(3)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::GroupTargetView::default())
  }
  pub fn group_mut(&mut self) -> super::GroupTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         3, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_group(&mut self,
    val: impl ::protobuf::IntoProxied<super::GroupTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        3,
        val
      );
    }
  }

  // middle: optional message DATA_MANAGER_FIXTURE.MiddleTarget
  pub fn has_middle(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(4)
    }
  }
  pub fn clear_middle(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        4
      );
    }
  }
  pub fn middle_opt(&self) -> ::protobuf::Optional<super::MiddleTargetView<'_>> {
        ::protobuf::Optional::new(self.middle(), self.has_middle())
  }
  pub fn middle(&self) -> super::MiddleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(4)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::MiddleTargetView::default())
  }
  pub fn middle_mut(&mut self) -> super::MiddleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         4, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_middle(&mut self,
    val: impl ::protobuf::IntoProxied<super::MiddleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        4,
        val
      );
    }
  }

  // noKey: optional message DATA_MANAGER_FIXTURE.NoKeyTarget
  pub fn has_noKey(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(5)
    }
  }
  pub fn clear_noKey(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        5
      );
    }
  }
  pub fn noKey_opt(&self) -> ::protobuf::Optional<super::NoKeyTargetView<'_>> {
        ::protobuf::Optional::new(self.noKey(), self.has_noKey())
  }
  pub fn noKey(&self) -> super::NoKeyTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(5)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::NoKeyTargetView::default())
  }
  pub fn noKey_mut(&mut self) -> super::NoKeyTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         5, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_noKey(&mut self,
    val: impl ::protobuf::IntoProxied<super::NoKeyTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        5,
        val
      );
    }
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(&self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        6, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_state(&mut self, val: super::FixtureState) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        6, val.into()
      )
    }
  }

}

// SAFETY:
// - `RootTargetMut` does not perform any shared mutation.
unsafe impl Send for RootTargetMut<'_> {}

// SAFETY:
// - `RootTargetMut` does not perform any shared mutation.
unsafe impl Sync for RootTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for RootTargetMut<'msg> {
  type Proxied = RootTarget;
  fn as_view(&self) -> ::protobuf::View<'_, RootTarget> {
    RootTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for RootTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, RootTarget>
  where
      'msg: 'shorter {
    RootTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for RootTargetMut<'msg> {
  type MutProxied = RootTarget;
  fn as_mut(&mut self) -> RootTargetMut<'msg> {
    RootTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for RootTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> RootTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl RootTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, RootTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> RootTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> RootTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // single: optional message DATA_MANAGER_FIXTURE.SingleTarget
  pub fn has_single(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_single(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn single_opt(&self) -> ::protobuf::Optional<super::SingleTargetView<'_>> {
        ::protobuf::Optional::new(self.single(), self.has_single())
  }
  pub fn single(&self) -> super::SingleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::SingleTargetView::default())
  }
  pub fn single_mut(&mut self) -> super::SingleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_single(&mut self,
    val: impl ::protobuf::IntoProxied<super::SingleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

  // composite: optional message DATA_MANAGER_FIXTURE.CompositeTarget
  pub fn has_composite(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(2)
    }
  }
  pub fn clear_composite(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        2
      );
    }
  }
  pub fn composite_opt(&self) -> ::protobuf::Optional<super::CompositeTargetView<'_>> {
        ::protobuf::Optional::new(self.composite(), self.has_composite())
  }
  pub fn composite(&self) -> super::CompositeTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(2)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CompositeTargetView::default())
  }
  pub fn composite_mut(&mut self) -> super::CompositeTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         2, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_composite(&mut self,
    val: impl ::protobuf::IntoProxied<super::CompositeTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        val
      );
    }
  }

  // group: optional message DATA_MANAGER_FIXTURE.GroupTarget
  pub fn has_group(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(3)
    }
  }
  pub fn clear_group(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        3
      );
    }
  }
  pub fn group_opt(&self) -> ::protobuf::Optional<super::GroupTargetView<'_>> {
        ::protobuf::Optional::new(self.group(), self.has_group())
  }
  pub fn group(&self) -> super::GroupTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(3)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::GroupTargetView::default())
  }
  pub fn group_mut(&mut self) -> super::GroupTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         3, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_group(&mut self,
    val: impl ::protobuf::IntoProxied<super::GroupTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        3,
        val
      );
    }
  }

  // middle: optional message DATA_MANAGER_FIXTURE.MiddleTarget
  pub fn has_middle(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(4)
    }
  }
  pub fn clear_middle(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        4
      );
    }
  }
  pub fn middle_opt(&self) -> ::protobuf::Optional<super::MiddleTargetView<'_>> {
        ::protobuf::Optional::new(self.middle(), self.has_middle())
  }
  pub fn middle(&self) -> super::MiddleTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(4)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::MiddleTargetView::default())
  }
  pub fn middle_mut(&mut self) -> super::MiddleTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         4, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_middle(&mut self,
    val: impl ::protobuf::IntoProxied<super::MiddleTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        4,
        val
      );
    }
  }

  // noKey: optional message DATA_MANAGER_FIXTURE.NoKeyTarget
  pub fn has_noKey(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(5)
    }
  }
  pub fn clear_noKey(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        5
      );
    }
  }
  pub fn noKey_opt(&self) -> ::protobuf::Optional<super::NoKeyTargetView<'_>> {
        ::protobuf::Optional::new(self.noKey(), self.has_noKey())
  }
  pub fn noKey(&self) -> super::NoKeyTargetView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(5)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::NoKeyTargetView::default())
  }
  pub fn noKey_mut(&mut self) -> super::NoKeyTargetMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         5, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_noKey(&mut self,
    val: impl ::protobuf::IntoProxied<super::NoKeyTarget>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        5,
        val
      );
    }
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(&self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        6, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_state(&mut self, val: super::FixtureState) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        6, val.into()
      )
    }
  }

}  // impl RootTarget

impl ::std::ops::Drop for RootTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for RootTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for RootTarget {
  type Proxied = Self;
  fn as_view(&self) -> RootTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for RootTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> RootTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for RootTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__RootTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P33333.P");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__RootTarget_msg_init.0, &[<super::SingleTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            <super::CompositeTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            <super::GroupTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            <super::MiddleTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            <super::NoKeyTarget as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table(),
            ], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__RootTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for RootTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for RootTarget {
  type Msg = RootTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<RootTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for RootTarget {
  type Msg = RootTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<RootTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for RootTargetMut<'_> {
  type Msg = RootTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<RootTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for RootTargetMut<'_> {
  type Msg = RootTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<RootTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for RootTargetView<'_> {
  type Msg = RootTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<RootTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for RootTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__CycleA_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct CycleA {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<CycleA>
}

impl ::protobuf::Message for CycleA {}

impl ::std::default::Default for CycleA {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for CycleA {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `CycleA` is `Sync` because it does not implement interior mutability.
//    Neither does `CycleAMut`.
unsafe impl Sync for CycleA {}

// SAFETY:
// - `CycleA` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for CycleA {}

impl ::protobuf::Proxied for CycleA {
  type View<'msg> = CycleAView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for CycleA {}

impl ::protobuf::MutProxied for CycleA {
  type Mut<'msg> = CycleAMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct CycleAView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CycleA>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CycleAView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for CycleAView<'msg> {
  type Message = CycleA;
}

impl ::std::fmt::Debug for CycleAView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for CycleAView<'_> {
  fn default() -> CycleAView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, CycleA>> for CycleAView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CycleA>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CycleAView<'msg> {

  pub fn to_owned(&self) -> CycleA {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // b: optional message DATA_MANAGER_FIXTURE.CycleB
  pub fn has_b(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn b_opt(self) -> ::protobuf::Optional<super::CycleBView<'msg>> {
        ::protobuf::Optional::new(self.b(), self.has_b())
  }
  pub fn b(self) -> super::CycleBView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleBView::default())
  }

}

// SAFETY:
// - `CycleAView` is `Sync` because it does not support mutation.
unsafe impl Sync for CycleAView<'_> {}

// SAFETY:
// - `CycleAView` is `Send` because while its alive a `CycleAMut` cannot.
// - `CycleAView` does not use thread-local data.
unsafe impl Send for CycleAView<'_> {}

impl<'msg> ::protobuf::AsView for CycleAView<'msg> {
  type Proxied = CycleA;
  fn as_view(&self) -> ::protobuf::View<'msg, CycleA> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CycleAView<'msg> {
  fn into_view<'shorter>(self) -> CycleAView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<CycleA> for CycleAView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CycleA {
    let mut dst = CycleA::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<CycleA> for CycleAMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CycleA {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for CycleA {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CycleAView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CycleAMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct CycleAMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleA>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CycleAMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for CycleAMut<'msg> {
  type Message = CycleA;
}

impl ::std::fmt::Debug for CycleAMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, CycleA>> for CycleAMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleA>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CycleAMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleA> {
    self.inner
  }

  pub fn to_owned(&self) -> CycleA {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // b: optional message DATA_MANAGER_FIXTURE.CycleB
  pub fn has_b(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_b(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn b_opt(&self) -> ::protobuf::Optional<super::CycleBView<'_>> {
        ::protobuf::Optional::new(self.b(), self.has_b())
  }
  pub fn b(&self) -> super::CycleBView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleBView::default())
  }
  pub fn b_mut(&mut self) -> super::CycleBMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_b(&mut self,
    val: impl ::protobuf::IntoProxied<super::CycleB>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}

// SAFETY:
// - `CycleAMut` does not perform any shared mutation.
unsafe impl Send for CycleAMut<'_> {}

// SAFETY:
// - `CycleAMut` does not perform any shared mutation.
unsafe impl Sync for CycleAMut<'_> {}

impl<'msg> ::protobuf::AsView for CycleAMut<'msg> {
  type Proxied = CycleA;
  fn as_view(&self) -> ::protobuf::View<'_, CycleA> {
    CycleAView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CycleAMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, CycleA>
  where
      'msg: 'shorter {
    CycleAView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for CycleAMut<'msg> {
  type MutProxied = CycleA;
  fn as_mut(&mut self) -> CycleAMut<'msg> {
    CycleAMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for CycleAMut<'msg> {
  fn into_mut<'shorter>(self) -> CycleAMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl CycleA {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, CycleA> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> CycleAView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> CycleAMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // b: optional message DATA_MANAGER_FIXTURE.CycleB
  pub fn has_b(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_b(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn b_opt(&self) -> ::protobuf::Optional<super::CycleBView<'_>> {
        ::protobuf::Optional::new(self.b(), self.has_b())
  }
  pub fn b(&self) -> super::CycleBView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleBView::default())
  }
  pub fn b_mut(&mut self) -> super::CycleBMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_b(&mut self,
    val: impl ::protobuf::IntoProxied<super::CycleB>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}  // impl CycleA

impl ::std::ops::Drop for CycleA {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for CycleA {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for CycleA {
  type Proxied = Self;
  fn as_view(&self) -> CycleAView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for CycleA {
  type MutProxied = Self;
  fn as_mut(&mut self) -> CycleAMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for CycleA {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__CycleA_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P3");
        super::DATA_0MANAGER_0FIXTURE__CycleB_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P3");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__CycleA_msg_init.0, &[super::DATA_0MANAGER_0FIXTURE__CycleB_msg_init.0,
            ], &[]);
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__CycleB_msg_init.0, &[super::DATA_0MANAGER_0FIXTURE__CycleA_msg_init.0,
            ], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__CycleA_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CycleA {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CycleA {
  type Msg = CycleA;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleA> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleA {
  type Msg = CycleA;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleA> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CycleAMut<'_> {
  type Msg = CycleA;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleA> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleAMut<'_> {
  type Msg = CycleA;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleA> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleAView<'_> {
  type Msg = CycleA;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleA> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CycleAMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__CycleB_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct CycleB {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<CycleB>
}

impl ::protobuf::Message for CycleB {}

impl ::std::default::Default for CycleB {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for CycleB {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `CycleB` is `Sync` because it does not implement interior mutability.
//    Neither does `CycleBMut`.
unsafe impl Sync for CycleB {}

// SAFETY:
// - `CycleB` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for CycleB {}

impl ::protobuf::Proxied for CycleB {
  type View<'msg> = CycleBView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for CycleB {}

impl ::protobuf::MutProxied for CycleB {
  type Mut<'msg> = CycleBMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct CycleBView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CycleB>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CycleBView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for CycleBView<'msg> {
  type Message = CycleB;
}

impl ::std::fmt::Debug for CycleBView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for CycleBView<'_> {
  fn default() -> CycleBView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, CycleB>> for CycleBView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CycleB>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CycleBView<'msg> {

  pub fn to_owned(&self) -> CycleB {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // a: optional message DATA_MANAGER_FIXTURE.CycleA
  pub fn has_a(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn a_opt(self) -> ::protobuf::Optional<super::CycleAView<'msg>> {
        ::protobuf::Optional::new(self.a(), self.has_a())
  }
  pub fn a(self) -> super::CycleAView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleAView::default())
  }

}

// SAFETY:
// - `CycleBView` is `Sync` because it does not support mutation.
unsafe impl Sync for CycleBView<'_> {}

// SAFETY:
// - `CycleBView` is `Send` because while its alive a `CycleBMut` cannot.
// - `CycleBView` does not use thread-local data.
unsafe impl Send for CycleBView<'_> {}

impl<'msg> ::protobuf::AsView for CycleBView<'msg> {
  type Proxied = CycleB;
  fn as_view(&self) -> ::protobuf::View<'msg, CycleB> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CycleBView<'msg> {
  fn into_view<'shorter>(self) -> CycleBView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<CycleB> for CycleBView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CycleB {
    let mut dst = CycleB::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<CycleB> for CycleBMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CycleB {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for CycleB {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CycleBView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CycleBMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct CycleBMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleB>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CycleBMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for CycleBMut<'msg> {
  type Message = CycleB;
}

impl ::std::fmt::Debug for CycleBMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, CycleB>> for CycleBMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleB>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CycleBMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, CycleB> {
    self.inner
  }

  pub fn to_owned(&self) -> CycleB {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // a: optional message DATA_MANAGER_FIXTURE.CycleA
  pub fn has_a(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_a(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn a_opt(&self) -> ::protobuf::Optional<super::CycleAView<'_>> {
        ::protobuf::Optional::new(self.a(), self.has_a())
  }
  pub fn a(&self) -> super::CycleAView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleAView::default())
  }
  pub fn a_mut(&mut self) -> super::CycleAMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_a(&mut self,
    val: impl ::protobuf::IntoProxied<super::CycleA>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}

// SAFETY:
// - `CycleBMut` does not perform any shared mutation.
unsafe impl Send for CycleBMut<'_> {}

// SAFETY:
// - `CycleBMut` does not perform any shared mutation.
unsafe impl Sync for CycleBMut<'_> {}

impl<'msg> ::protobuf::AsView for CycleBMut<'msg> {
  type Proxied = CycleB;
  fn as_view(&self) -> ::protobuf::View<'_, CycleB> {
    CycleBView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CycleBMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, CycleB>
  where
      'msg: 'shorter {
    CycleBView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for CycleBMut<'msg> {
  type MutProxied = CycleB;
  fn as_mut(&mut self) -> CycleBMut<'msg> {
    CycleBMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for CycleBMut<'msg> {
  fn into_mut<'shorter>(self) -> CycleBMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl CycleB {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, CycleB> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> CycleBView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> CycleBMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // a: optional message DATA_MANAGER_FIXTURE.CycleA
  pub fn has_a(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_a(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn a_opt(&self) -> ::protobuf::Optional<super::CycleAView<'_>> {
        ::protobuf::Optional::new(self.a(), self.has_a())
  }
  pub fn a(&self) -> super::CycleAView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CycleAView::default())
  }
  pub fn a_mut(&mut self) -> super::CycleAMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_a(&mut self,
    val: impl ::protobuf::IntoProxied<super::CycleA>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

}  // impl CycleB

impl ::std::ops::Drop for CycleB {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for CycleB {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for CycleB {
  type Proxied = Self;
  fn as_view(&self) -> CycleBView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for CycleB {
  type MutProxied = Self;
  fn as_mut(&mut self) -> CycleBMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for CycleB {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        <super::CycleA as ::protobuf::__internal::runtime::AssociatedMiniTable>::mini_table();
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__CycleB_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CycleB {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CycleB {
  type Msg = CycleB;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleB> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleB {
  type Msg = CycleB;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleB> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CycleBMut<'_> {
  type Msg = CycleB;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleB> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleBMut<'_> {
  type Msg = CycleB;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleB> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CycleBView<'_> {
  type Msg = CycleB;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CycleB> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CycleBMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



