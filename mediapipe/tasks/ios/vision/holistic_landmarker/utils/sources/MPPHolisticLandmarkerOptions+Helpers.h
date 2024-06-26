// Copyright 2024 The MediaPipe Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#ifndef __cplusplus
#error "This file requires Objective-C++."
#endif  // __cplusplus

#include "google/protobuf/any.pb.h"

#import "mediapipe/tasks/ios/core/sources/MPPTaskOptionsProtocol.h"
#import "mediapipe/tasks/ios/vision/holistic_landmarker/sources/MPPHolisticLandmarkerOptions.h"

NS_ASSUME_NONNULL_BEGIN

@interface MPPHolisticLandmarkerOptions (Helpers) <MPPTaskOptionsProtocol>

/**
 * Populates the provided `google::protobuf::Any` proto  with the current settings.
 *
 * @param optionsProto The `::google::protobuf::Any` proto object to copy the settings to.
 */
- (void)copyToAnyProto:(::google::protobuf::Any *)optionsProto;

@end

NS_ASSUME_NONNULL_END
