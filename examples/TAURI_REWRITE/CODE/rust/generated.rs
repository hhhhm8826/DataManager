#[path="CategoryTable.u.pb.rs"]
#[allow(nonstandard_style)]
pub mod internal_do_not_use_CategoryTable;

#[allow(unused_imports, nonstandard_style)]
pub use internal_do_not_use_CategoryTable::*;
#[path="FixtureEnumType.u.pb.rs"]
#[allow(nonstandard_style)]
pub mod internal_do_not_use_FixtureEnumType;

#[allow(unused_imports, nonstandard_style)]
pub use internal_do_not_use_FixtureEnumType::*;
#[path="KeyTable.u.pb.rs"]
#[allow(nonstandard_style)]
pub mod internal_do_not_use_KeyTable;

#[allow(unused_imports, nonstandard_style)]
pub use internal_do_not_use_KeyTable::*;
#[path="ReferenceTable.u.pb.rs"]
#[allow(nonstandard_style)]
pub mod internal_do_not_use_ReferenceTable;

#[allow(unused_imports, nonstandard_style)]
pub use internal_do_not_use_ReferenceTable::*;
pub mod __unstable {
pub static CATEGORYTABLE_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
  descriptor: b"\n\x13\x43\x61tegoryTable.proto\x12\x05\x64\x31\x30\x30\x30\"j\n\x08\x43\x61tegory\x12\n\n\x02id\x18\x01 \x01(\x05\x12$\n\x06parent\x18\x02 \x01(\x0b\x32\x0f.d1000.CategoryH\x00\x88\x01\x01\x12!\n\x08\x63hildren\x18\x03 \x03(\x0b\x32\x0f.d1000.CategoryB\t\n\x07_parentB\tZ\x07./d1000b\x06proto3",
  deps: &[
  ],
};
pub static FIXTUREENUMTYPE_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
  descriptor: b"\n\x15\x46ixtureEnumType.proto\x12\x14\x44\x41TA_MANAGER_FIXTURE*T\n\x0c\x46ixtureState\x12\x15\n\x11\x46ixtureState_NONE\x10\x00\x12\x17\n\x13\x46ixtureState_ACTIVE\x10\x01\x12\x14\n\x10\x46ixtureState_MAX\x10\x02\x42\x18Z\x16./DATA_MANAGER_FIXTUREb\x06proto3",
  deps: &[
  ],
};
pub static KEYTABLE_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
  descriptor: b"\n\x0eKeyTable.proto\x12\x14\x44\x41TA_MANAGER_FIXTURE\x1a\x15\x46ixtureEnumType.proto\"\\\n\x0cSingleTarget\x12\n\n\x02id\x18\x01 \x01(\x05\x12\r\n\x05label\x18\x02 \x01(\t\x12\x31\n\x05state\x18\x03 \x01(\x0e\x32\".DATA_MANAGER_FIXTURE.FixtureState\"<\n\x0f\x43ompositeTarget\x12\x0e\n\x06region\x18\x01 \x01(\x05\x12\n\n\x02id\x18\x02 \x01(\x05\x12\r\n\x05label\x18\x03 \x01(\t\"-\n\x0bGroupTarget\x12\x0f\n\x07groupId\x18\x01 \x01(\x05\x12\r\n\x05label\x18\x02 \x01(\t\"\x1c\n\x0bNoKeyTarget\x12\r\n\x05label\x18\x01 \x01(\tB\x18Z\x16./DATA_MANAGER_FIXTUREb\x06proto3",
  deps: &[
    &super::__unstable::FIXTUREENUMTYPE_DESCRIPTOR_INFO,
  ],
};
pub static REFERENCETABLE_DESCRIPTOR_INFO: ::protobuf::__internal::runtime::__unstable::DescriptorInfo = ::protobuf::__internal::runtime::__unstable::DescriptorInfo {
  descriptor: b"\n\x14ReferenceTable.proto\x12\x14\x44\x41TA_MANAGER_FIXTURE\x1a\x15\x46ixtureEnumType.proto\x1a\x0eKeyTable.proto\"N\n\x0cMiddleTarget\x12\n\n\x02id\x18\x01 \x01(\x05\x12\x32\n\x06single\x18\x02 \x01(\x0b\x32\".DATA_MANAGER_FIXTURE.SingleTarget\"\xd1\x02\n\nRootTarget\x12\n\n\x02id\x18\x01 \x01(\x05\x12\x32\n\x06single\x18\x02 \x01(\x0b\x32\".DATA_MANAGER_FIXTURE.SingleTarget\x12\x38\n\tcomposite\x18\x03 \x01(\x0b\x32%.DATA_MANAGER_FIXTURE.CompositeTarget\x12\x30\n\x05group\x18\x04 \x01(\x0b\x32!.DATA_MANAGER_FIXTURE.GroupTarget\x12\x32\n\x06middle\x18\x05 \x01(\x0b\x32\".DATA_MANAGER_FIXTURE.MiddleTarget\x12\x30\n\x05noKey\x18\x06 \x01(\x0b\x32!.DATA_MANAGER_FIXTURE.NoKeyTarget\x12\x31\n\x05state\x18\x07 \x01(\x0e\x32\".DATA_MANAGER_FIXTURE.FixtureState\"=\n\x06\x43ycleA\x12\n\n\x02id\x18\x01 \x01(\x05\x12\'\n\x01\x62\x18\x02 \x01(\x0b\x32\x1c.DATA_MANAGER_FIXTURE.CycleB\"=\n\x06\x43ycleB\x12\n\n\x02id\x18\x01 \x01(\x05\x12\'\n\x01\x61\x18\x02 \x01(\x0b\x32\x1c.DATA_MANAGER_FIXTURE.CycleAB\x18Z\x16./DATA_MANAGER_FIXTUREb\x06proto3",
  deps: &[
    &super::__unstable::FIXTUREENUMTYPE_DESCRIPTOR_INFO,
    &super::__unstable::KEYTABLE_DESCRIPTOR_INFO,
  ],
};
}
